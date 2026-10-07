import asyncio
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from lattice_notifications.mailer import RecordingMailer
from lattice_notifications.main import create_app
from lattice_notifications.settings import Settings
from lattice_shared.events import Event, EventType, Recipient

SECRET = "test-secret-test-secret-test-secret"
API = "/api/v1/notifications"


def token(user_id: int) -> dict:
    t = jwt.encode({"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(hours=1)},
                   SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture
def app(tmp_path):
    settings = Settings(notify_database_url=f"sqlite:///{tmp_path}/n.sqlite3", redis_url="",
                        jwt_secret=SECRET)
    mailer = RecordingMailer()
    application = create_app(settings, mailer=mailer, consume=False)
    application.state.mailer = mailer
    return application


def deliver(app, event: Event) -> None:
    asyncio.run(app.state.handler.handle(event))


def low_stock(*recipients: Recipient) -> Event:
    return Event(type=EventType.LOW_STOCK, title="Low stock: PRB", body="1 available",
                 link="/templates/1", recipients=list(recipients),
                 payload={"components": [{"name": "PRB", "available": 1}]})


def test_events_become_notifications_and_emails(app):
    event = low_stock(Recipient(user_id=1, email="a@x.io"), Recipient(email="ops@x.io"))
    deliver(app, event)
    deliver(app, event)  # redelivery is idempotent
    assert sorted(to for to, _, _ in app.state.mailer.sent) == ["a@x.io", "a@x.io", "ops@x.io",
                                                               "ops@x.io"]
    with TestClient(app) as client:
        page = client.get(API, headers=token(1)).json()
        assert page["total"] == 1
        n = page["items"][0]
        assert n["payload"]["components"][0]["name"] == "PRB" and n["read"] is False
        assert client.get(API, headers=token(2)).json()["total"] == 0


def test_read_state_and_counts(app):
    for _ in range(3):
        deliver(app, low_stock(Recipient(user_id=7)))
    with TestClient(app) as client:
        h = token(7)
        first = client.get(API, headers=h).json()["items"][0]
        assert client.put(f"{API}/{first['id']}/read", headers=h).status_code == 204
        assert client.get(f"{API}/counts", headers=h).json() == {"total": 3, "unread": 2,
                                                                 "read": 1}
        assert client.get(f"{API}?filter=read", headers=h).json()["total"] == 1
        client.put(f"{API}/{first['id']}/read", headers=h, json={"read": False})
        assert client.get(f"{API}/counts", headers=h).json()["unread"] == 3
        assert client.post(f"{API}/read-all", headers=h).status_code == 204
        assert client.get(f"{API}?filter=unread", headers=h).json()["total"] == 0


def test_someone_elses_notification_is_not_found(app):
    deliver(app, low_stock(Recipient(user_id=1)))
    with TestClient(app) as client:
        nid = client.get(API, headers=token(1)).json()["items"][0]["id"]
        r = client.put(f"{API}/{nid}/read", headers=token(2))
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
        assert client.get(API).status_code == 401
        assert client.get(API, headers={"Authorization": "Bearer junk"}).status_code == 401
