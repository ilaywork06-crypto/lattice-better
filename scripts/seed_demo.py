"""Fill an EMPTY Lattice with a small, realistic demo world — through the public API.

    uv run python scripts/seed_demo.py [--url http://localhost:8000] [--admin admin@lattice.io:admin1234]

Lattice ships empty on purpose; this is for demos and for trying the UI. Every
row is created exactly as a user would create it, so it doubles as an
end-to-end check of the API. Demo accounts use the password "demo1234" and are
published on the sign-in screen.
"""

from __future__ import annotations

import argparse
import random
import sys

import httpx

PASSWORD = "demo1234"


class Api:
    def __init__(self, base: str, email: str, password: str) -> None:
        self.c = httpx.Client(base_url=base.rstrip("/") + "/api/v1", timeout=30)
        r = self.c.post("/auth/token", data={"username": email, "password": password})
        r.raise_for_status()
        self.c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    def __call__(self, method: str, path: str, **kw):
        r = self.c.request(method, path, **kw)
        if r.status_code >= 400:
            sys.exit(f"{method} {path} → {r.status_code}: {r.text}")
        return r.json() if r.content else None


def field(label, field_type, mode="item", required=False, **extra):
    return {"label": label, "field_type": field_type, "mode": mode, "required": required, **extra}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="http://localhost:8000")
    p.add_argument("--admin", default="admin@lattice.io:admin1234")
    args = p.parse_args()
    email, password = args.admin.split(":", 1)
    api = Api(args.url, email, password)
    random.seed(7)

    if api("GET", "/templates"):
        sys.exit("This Lattice already has templates — the demo seeder only fills an empty system.")

    # ── people ──
    people = {}
    for mail, name, role in [
        ("noa@lattice.io", "Noa Levi", "manager"),
        ("dana@lattice.io", "Dana Cohen", "editor"),
        ("amir@lattice.io", "Amir Katz", "viewer"),
        ("yael@lattice.io", "Yael Mizrahi", "editor"),
    ]:
        u = api("POST", "/users", json={"email": mail, "full_name": name, "password": PASSWORD, "role": role})
        api("PATCH", f"/users/{u['id']}", json={"login_hint_visible": True, "login_hint_password": PASSWORD})
        people[mail] = u
    me = api("GET", "/auth/me")

    # ── catalog ──
    cat = {}
    for category, values in [("project", ["Falcon", "Sparrow", "Horizon"]),
                             ("industry", ["Avionics", "Space", "Defense"]),
                             ("team", ["HW Team A", "Integration", "RF Lab"])]:
        for i, v in enumerate(values):
            cat[v] = api("POST", "/catalog", json={"category": category, "value": v, "sort_order": i})
    api("PUT", f"/catalog/{cat['HW Team A']['id']}/links",
        json={"category": "industry", "option_ids": [cat["Avionics"]["id"], cat["Space"]["id"]]})
    api("PUT", f"/catalog/{cat['HW Team A']['id']}/links",
        json={"category": "project", "option_ids": [cat["Falcon"]["id"], cat["Sparrow"]["id"]]})
    api("PUT", f"/catalog/{cat['RF Lab']['id']}/links",
        json={"category": "project", "option_ids": [cat["Horizon"]["id"]]})

    # ── floor plan & locations ──
    for name, x, y, w, h, color in [("Building A · Labs", 4, 6, 44, 40, "#6366f1"),
                                    ("Integration Hall", 52, 6, 44, 30, "#14b8a6"),
                                    ("Stores", 52, 42, 22, 30, "#f59e0b"),
                                    ("Clean Room", 78, 42, 18, 30, "#0ea5e9")]:
        api("POST", "/map/buildings", json={"name": name, "x": x, "y": y, "width": w, "height": h, "color": color})
    loc = {}
    for name, building, room, x, y in [
        ("Lab A — Bench 1", "A", "101", 14, 20), ("Lab A — Bench 4", "A", "104", 34, 22),
        ("RF Lab", "A", "110", 24, 38), ("Integration Hall", "B", None, 72, 20),
        ("Stores — Shelf 3", "C", "S3", 62, 56), ("Desiccator 1", "D", "Clean", 84, 52),
        ("Desiccator 2", "D", "Clean", 90, 62),
    ]:
        loc[name] = api("POST", "/locations", json={"name": name, "building": building, "room": room, "x": x, "y": y})
    api("PUT", "/locations/desiccator", json={"location_ids": [loc["Desiccator 1"]["id"], loc["Desiccator 2"]["id"]]})

    # ── field groups ──
    api("POST", "/field-groups", json={
        "name": "Traceability", "description": "Where a board came from",
        "fields": [field("Manufactured", "date"), field("Supplier", "text"), field("Lot", "string", config={"pattern": "LOT-####"})],
    })

    # ── templates ──
    noa = people["noa@lattice.io"]
    projects = [cat["Falcon"]["id"], cat["Sparrow"]["id"], cat["Horizon"]["id"]]

    def card(name, prefix, card_type, extra=(), managers=None):
        fields = [
            field("Project", "project", "choice", config={"options": projects}),
            field("Managers", "managers", "fixed", fixed_value=managers or [noa["id"]]),
            field("Revision", "string", config={"pattern": "RV-##"}),
            field("Location", "location"),
            field("Manufactured", "date"),
            *extra,
        ]
        return api("POST", "/templates", json={"type": "card", "name": name, "card_type": card_type,
                                              "serial_prefix": prefix, "fields": fields})

    prb = card("Power Regulator Board", "PRB", "house", [field("Datasheet", "files", "fixed")])
    dsp = card("DSP Processing Card", "DSP", "house")
    rfa = card("RF Amplifier", "RFA", "factory", [field("Band", "enum", "item", True, config={"options": ["L", "S", "C", "X"]})])
    ioc = card("I/O Controller", "IOC", "copied")
    fan = api("POST", "/templates", json={
        "type": "card", "name": "Cooling Fan 40mm", "card_type": "commercial", "serial_prefix": "FAN",
        "fields": [field("Quantity", "quantity", required=True), field("Location", "location")],
    })
    spm = api("POST", "/templates", json={
        "type": "assembly", "name": "Signal Processing Module", "serial_prefix": "SPM",
        "description": "Two power boards, one DSP and an I/O controller in a 3U chassis.",
        "fields": [field("Location", "location"), field("Team", "team", "fixed", fixed_value=cat["HW Team A"]["id"]),
                   field("Notes", "text")],
        "children": [{"template_id": prb["id"], "min_count": 2, "max_count": 2},
                     {"template_id": dsp["id"], "min_count": 1, "max_count": 1},
                     {"template_id": ioc["id"], "min_count": 0, "max_count": 1},
                     {"template_id": fan["id"], "max_count": 8}],
    })
    rfm = api("POST", "/templates", json={
        "type": "assembly", "name": "RF Front-End", "serial_prefix": "RFE",
        "fields": [field("Location", "location"), field("Team", "team", "fixed", fixed_value=cat["RF Lab"]["id"])],
        "children": [{"template_id": rfa["id"], "min_count": 1, "max_count": 4}],
    })
    rig = api("POST", "/templates", json={
        "type": "setup", "name": "Flight Test Rig", "serial_prefix": "FTR",
        "description": "Hardware-in-the-loop rig for the Falcon program.",
        "fields": [field("Location", "location"), field("Owner", "responsible", required=True),
                   field("Project", "project", "fixed", fixed_value=cat["Falcon"]["id"]),
                   field("Managers", "managers", "fixed", fixed_value=[noa["id"], me["id"]])],
        "children": [{"template_id": spm["id"], "min_count": 1, "max_count": 2},
                     {"template_id": rfm["id"], "max_count": 1},
                     {"template_id": prb["id"], "max_count": 2}],
    })

    # ── items ──
    def make(tpl, **values):
        return api("POST", "/items", json={"template_id": tpl["id"], "values": values})

    des = [loc["Desiccator 1"]["id"], loc["Desiccator 2"]["id"]]
    boards = [make(prb, revision=f"0{random.randint(1, 4)}", location=random.choice(des),
                   manufactured=f"2026-0{random.randint(1, 8)}-1{random.randint(0, 9)}") for _ in range(9)]
    dsps = [make(dsp, revision="02", location=random.choice(des)) for _ in range(4)]
    ios = [make(ioc, location=random.choice(des)) for _ in range(3)]
    amps = [make(rfa, band=random.choice("LSCX"), location=random.choice(des)) for _ in range(5)]
    fans = make(fan, quantity=24, location=loc["Stores — Shelf 3"]["id"])
    del fans

    modules = []
    for i in range(2):
        m = make(spm, location=loc["Integration Hall"]["id"], notes="Built for flight test" if i == 0 else None)
        api("PUT", f"/items/{m['id']}/children",
            json={"child_ids": [boards[2 * i]["id"], boards[2 * i + 1]["id"], dsps[i]["id"], ios[i]["id"]]})
        modules.append(m)
    third = make(spm, location=loc["Lab A — Bench 1"]["id"])
    api("POST", f"/items/{boards[4]['id']}/link", json={"parent_id": third["id"]})
    rf = make(rfm, location=loc["RF Lab"]["id"])
    for a in amps[:2]:
        api("POST", f"/items/{a['id']}/link", json={"parent_id": rf["id"]})
    test_rig = make(rig, owner=people["dana@lattice.io"]["id"], location=loc["Integration Hall"]["id"])
    api("PUT", f"/items/{test_rig['id']}/children", json={"child_ids": [modules[0]["id"], rf["id"]]})
    api("POST", f"/items/{test_rig['id']}/extras",
        json={"name": "Bench power supply", "company_part_number": "PS-3005D", "serial": "PSU-88231", "signed_by": "Noa Levi"})
    api("POST", f"/items/{test_rig['id']}/move", json={"location_id": loc["Lab A — Bench 4"]["id"], "note": "Moved for HIL session"})

    api("POST", f"/items/{boards[6]['id']}/state", json={"state": "faulty", "note": "U12 regulator overheats under load"})
    api("POST", f"/items/{boards[7]['id']}/state", json={"state": "ok", "note": "Passed acceptance test"})
    api("POST", f"/items/{dsps[3]['id']}/state", json={"state": "ok"})
    api("POST", f"/items/{amps[4]['id']}/move", json={"location_id": loc["RF Lab"]["id"]})

    # ── thresholds ──
    api("PUT", f"/inventory/thresholds/{prb['id']}", json={"min_quantity": 4})
    api("PUT", f"/inventory/thresholds/{dsp['id']}", json={"min_quantity": 2})
    api("PUT", f"/inventory/thresholds/{rfa['id']}", json={"min_quantity": 3, "notify_email": "rf-lab@lattice.io"})

    # ── proposals (as the editor and the viewer) ──
    editor = Api(args.url, "dana@lattice.io", PASSWORD)
    editor("POST", "/change-requests", json={
        "action": "state_change", "item_id": amps[2]["id"],
        "payload": {"state": "faulty", "note": "No gain on channel B"}, "reason": "Found during bench test",
    })
    editor("POST", "/change-requests", json={
        "action": "create", "payload": {"template_id": dsp["id"], "values": {"revision": "03"}},
        "reason": "A new DSP card arrived from the vendor",
    })
    viewer = Api(args.url, "amir@lattice.io", PASSWORD)
    viewer("POST", "/change-requests", json={
        "action": "move", "item_id": third["id"], "payload": {"location_id": loc["RF Lab"]["id"]},
        "reason": "Needed for the RF integration on Thursday",
    })
    print(f"Demo world ready. Sign in as admin, or as noa/dana/amir/yael@lattice.io with '{PASSWORD}'.")


if __name__ == "__main__":
    main()
