from conftest import API


def test_health(world):
    assert world.client.get("/health").json()["status"] == "ok"


def test_sign_in_returns_the_user_and_their_permissions(world):
    r = world.client.post(f"{API}/auth/token",
                          data={"username": "dana@lattice.io", "password": "password"})
    body = r.json()
    assert body["user"]["role"] == "editor"
    assert "propose_changes" in body["user"]["permissions"]
    assert "write_items" not in body["user"]["permissions"]


def test_wrong_password_is_a_401_in_the_error_envelope(world):
    r = world.client.post(f"{API}/auth/token",
                          data={"username": "dana@lattice.io", "password": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthenticated"


def test_requests_need_a_token(world):
    r = world.client.get(f"{API}/items")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthenticated"


def test_me_lists_what_each_role_may_propose(world):
    viewer = world.as_("viewer").ok("GET", "/auth/me")
    assert viewer["proposable_actions"] == ["move"]
    manager = world.as_("manager").ok("GET", "/auth/me")
    assert "review_changes" in manager["permissions"]


def test_viewers_and_editors_cannot_mutate_directly(world):
    tpl = world.admin.template("Power Regulator Board")
    for who in ("viewer", "editor"):
        api = world.as_(who)
        r = api.post("/items", json={"template_id": tpl["id"]})
        assert r.status_code == 403, r.text
        assert r.json()["error"]["code"] == "forbidden"
        assert api.post("/catalog", json={"category": "project", "value": "X"}).status_code == 403


def test_login_hints_expose_only_what_a_manager_published(world, admin):
    assert world.client.get(f"{API}/auth/login-hints").json() == []
    dana = admin.user("dana@lattice.io")
    admin.ok("PATCH", f"/users/{dana['id']}", json={"login_hint_visible": True})
    hints = world.client.get(f"{API}/auth/login-hints").json()
    assert hints == [{"full_name": "Dana Editor", "email": "dana@lattice.io",
                      "role": "editor", "password": None}]
    out = admin.ok("PATCH", f"/users/{dana['id']}", json={"login_hint_password": "password"})
    assert out["login_hint_has_password"] is True
    assert "login_hint_password" not in out
    assert world.client.get(f"{API}/auth/login-hints").json()[0]["password"] == "password"


def test_password_over_the_bcrypt_byte_limit_is_a_clean_422(admin):
    r = admin.post("/users", json={"email": "x@lattice.io", "full_name": "X",
                                   "password": "א" * 40})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"


def test_a_user_with_proposals_cannot_be_deleted_but_can_be_deactivated(world, admin):
    editor = world.as_("editor")
    item = admin.create_item("Power Regulator Board")
    editor.ok("POST", "/change-requests", status=201, json={
        "action": "move", "item_id": item["id"],
        "payload": {"location_id": admin.location("Lab A")["id"]}, "reason": "bench test"})
    dana = admin.user("dana@lattice.io")
    r = admin.delete(f"/users/{dana['id']}")
    assert r.status_code == 409
    assert "Deactivate" in r.json()["error"]["message"]
    admin.ok("PATCH", f"/users/{dana['id']}", json={"is_active": False})
    r = world.client.post(f"{API}/auth/token",
                          data={"username": "dana@lattice.io", "password": "password"})
    assert r.status_code == 403


def test_managers_cannot_lock_themselves_out(admin):
    me = admin.ok("GET", "/auth/me")
    assert admin.delete(f"/users/{me['id']}").status_code == 400
    assert admin.patch(f"/users/{me['id']}", json={"is_active": False}).status_code == 400
