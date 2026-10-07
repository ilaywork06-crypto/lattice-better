def _stock(admin, name):
    return next(r for r in admin.ok("GET", "/inventory/stock") if r["name"] == name)


def test_available_is_built_or_ok_in_the_desiccator(admin):
    a = admin.create_item("Power Regulator Board")
    b = admin.create_item("Power Regulator Board")
    c = admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{b['id']}/state", json={"state": "faulty", "note": "dead"})
    admin.ok("POST", f"/items/{c['id']}/move", json={"location_id": admin.location("Lab A")["id"]})
    row = _stock(admin, "Power Regulator Board")
    assert (row["total"], row["available"], row["desiccator"], row["in_use"], row["faulty"]) == (
        3, 1, 2, 1, 1)
    assert row["available_serials"] == [a["serial"]]


def test_commercial_cards_count_units(admin):
    admin.create_item("Resistor Pack", values={"quantity": 25})
    row = _stock(admin, "Resistor Pack")
    assert (row["records"], row["total"], row["available"]) == (1, 25, 25)


def test_cards_assembled_inside_something_in_the_desiccator_still_count(admin):
    module = admin.create_item("Signal Processing Module")
    admin.ok("POST", f"/items/{module['id']}/move",
             json={"location_id": admin.location("Desiccator B")["id"]})
    card = admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{card['id']}/link", json={"parent_id": module["id"]})
    row = _stock(admin, "Power Regulator Board")
    assert (row["desiccator"], row["assembled_in_desiccator"], row["available"]) == (1, 1, 1)
    admin.ok("POST", f"/items/{module['id']}/move",
             json={"location_id": admin.location("Lab A")["id"]})
    row = _stock(admin, "Power Regulator Board")
    assert (row["assembled"], row["available"]) == (1, 0)


def test_thresholds_alert_once_per_recipient_and_only_for_touched_templates(world, admin):
    prb = admin.template("Power Regulator Board")
    res = admin.template("Resistor Pack")
    editor = world.as_("editor")
    out = editor.ok("PUT", f"/inventory/thresholds/{prb['id']}",
                    json={"min_quantity": 1, "notify_email": "stock@lattice.io"})
    assert (out["available"], out["is_low"]) == (0, True)
    alerts = world.events.of_type("inventory.low_stock")
    assert {r.email for e in alerts for r in e.recipients} >= {"stock@lattice.io"}
    world.events.clear()

    # A resistor change doesn't re-alert about the boards.
    admin.create_item("Resistor Pack", values={"quantity": 5})
    assert world.events.of_type("inventory.low_stock") == []

    card = admin.create_item("Power Regulator Board")
    admin.create_item("Power Regulator Board")
    assert world.events.of_type("inventory.low_stock") != []  # the first one left it at 1
    world.events.clear()
    admin.ok("POST", f"/items/{card['id']}/move",
             json={"location_id": admin.location("Lab A")["id"]})
    lows = world.events.of_type("inventory.low_stock")
    component = lows[0].payload["components"][0]
    assert component["name"] == "Power Regulator Board"
    assert (component["available"], component["min_quantity"]) == (1, 1)
    # Noa manages these boards → only Noa (plus the extra email) is told.
    assert {r.email for e in lows for r in e.recipients} == {"noa@lattice.io", "stock@lattice.io"}
    assert admin.ok("GET", "/inventory/thresholds?low_only=true")[0]["template_id"] == prb["id"]
    assert world.as_("editor").delete(f"/inventory/thresholds/{prb['id']}").status_code == 403
    admin.ok("DELETE", f"/inventory/thresholds/{prb['id']}", status=204)
    assert admin.put(f"/inventory/thresholds/{admin.template('Flight Rig')['id']}",
                     json={"min_quantity": 1}).status_code == 400
    del res


def test_redefining_the_desiccator_reclassifies_stock(world, admin):
    admin.create_item("Power Regulator Board")
    lab = admin.location("Lab A")
    admin.ok("PUT", "/locations/desiccator", json={"location_ids": [lab["id"]]})
    row = _stock(admin, "Power Regulator Board")
    assert (row["in_use"], row["available"]) == (1, 0)
    r = world.as_("editor").put("/locations/desiccator", json={"location_ids": []})
    assert r.status_code == 403


def test_the_dashboard_matches_the_stock_table(admin):
    admin.create_item("Power Regulator Board")
    admin.create_item("Resistor Pack", values={"quantity": 10})
    admin.create_item("Flight Rig")
    s = admin.ok("GET", "/inventory/summary")
    assert (s["cards"], s["cards_available"], s["setups"], s["templates"]) == (11, 11, 1, 4)
