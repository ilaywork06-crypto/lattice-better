def test_viewers_may_propose_a_move_only(world, admin):
    viewer = world.as_("viewer")
    item = admin.create_item("Power Regulator Board")
    lab = admin.location("Lab A")
    r = viewer.post("/change-requests", json={"action": "state_change", "item_id": item["id"],
                                              "payload": {"state": "ok"}, "reason": "x"})
    assert r.status_code == 403
    cr = viewer.ok("POST", "/change-requests", status=201, json={
        "action": "move", "item_id": item["id"],
        "payload": {"location_id": lab["id"]}, "reason": "Needed on the bench"})
    assert cr["description"] == f"Move 'Power Regulator Board ({item['serial']})' to Lab A"
    assert cr["status"] == "pending" and cr["proposer"]["email"] == "amir@lattice.io"
    # the item's manager (Noa) is told, not every manager
    submitted = world.events.of_type("change_request.submitted")
    assert [r.email for r in submitted[-1].recipients] == ["noa@lattice.io"]

    world.as_("manager").ok("POST", f"/change-requests/{cr['id']}/approve",
                            json={"note": "go"})
    assert admin.ok("GET", f"/items/{item['id']}")["location"]["name"] == "Lab A"
    decided = world.events.of_type("change_request.approved")[-1]
    assert decided.recipients[0].email == "amir@lattice.io"


def test_a_malformed_proposal_is_refused_at_submission(world, admin):
    editor = world.as_("editor")
    item = admin.create_item("Power Regulator Board")
    r = editor.post("/change-requests", json={"action": "move", "item_id": item["id"],
                                              "payload": {"where": "lab"}, "reason": "x"})
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "validation_failed"
    assert err["issues"][0]["field"] == "location_id"


def test_editors_propose_items_and_approval_creates_them(world, admin):
    editor = world.as_("editor")
    tpl = admin.template("Power Regulator Board")
    cr = editor.ok("POST", "/change-requests", status=201, json={
        "action": "create", "payload": {"template_id": tpl["id"], "values": {"revision": "02"}},
        "reason": "New board arrived"})
    assert cr["item_type"] == "card"
    assert admin.template("Power Regulator Board")["counts"]["total"] == 0
    approved = admin.ok("POST", f"/change-requests/{cr['id']}/approve")
    assert approved["status"] == "approved" and approved["reviewer"]["role"] == "manager"
    assert admin.template("Power Regulator Board")["counts"]["total"] == 1
    r = admin.post(f"/change-requests/{cr['id']}/reject")
    assert "already been reviewed" in r.json()["error"]["message"]


def test_editors_propose_template_edits(world, admin):
    editor = world.as_("editor")
    tpl = admin.template("Resistor Pack")
    cr = editor.ok("POST", "/change-requests", status=201, json={
        "action": "template_update", "template_id": tpl["id"],
        "payload": {"description": "0402 resistor array"}, "reason": "clarify"})
    admin.ok("POST", f"/change-requests/{cr['id']}/approve")
    assert admin.ok("GET", f"/templates/{tpl['id']}")["description"] == "0402 resistor array"


def test_an_approval_that_no_longer_fits_is_a_400_and_changes_nothing(world, admin):
    editor = world.as_("editor")
    item = admin.create_item("Power Regulator Board")
    cr = editor.ok("POST", "/change-requests", status=201, json={
        "action": "state_change", "item_id": item["id"],
        "payload": {"state": "faulty", "note": "burnt"}, "reason": "burnt"})
    admin.ok("POST", f"/items/{item['id']}/state", json={"state": "faulty", "note": "already"})
    admin.ok("POST", f"/items/{item['id']}/state", json={"state": "ok", "note": "fixed"})
    # still valid → applies
    admin.ok("POST", f"/change-requests/{cr['id']}/approve")
    cr2 = editor.ok("POST", "/change-requests", status=201, json={
        "action": "link", "item_id": item["id"], "payload": {"parent_id": item["id"]},
        "reason": "oops"})
    r = admin.post(f"/change-requests/{cr2['id']}/approve")
    assert r.status_code == 400
    assert admin.ok("GET", f"/change-requests/{cr2['id']}")["status"] == "pending"


def test_requests_are_paged_and_filterable(world, admin):
    editor = world.as_("editor")
    item = admin.create_item("Power Regulator Board")
    for _ in range(3):
        editor.ok("POST", "/change-requests", status=201, json={
            "action": "delete", "item_id": item["id"], "reason": "scrap"})
    page = admin.ok("GET", "/change-requests?status=pending&limit=2")
    assert (page["total"], len(page["items"])) == (3, 2)
    assert admin.ok("GET", "/change-requests?mine=true")["total"] == 0
    assert editor.ok("GET", "/change-requests?mine=true")["total"] == 3
    assert admin.ok("GET", "/inventory/summary")["pending_change_requests"] == 3
