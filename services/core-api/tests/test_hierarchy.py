def test_links_follow_the_templates(admin):
    card = admin.create_item("Resistor Pack", values={"quantity": 1})
    rig = admin.create_item("Flight Rig")
    r = admin.post(f"/items/{card['id']}/link", json={"parent_id": rig["id"]})
    assert r.status_code == 400
    assert "don't include" in r.json()["error"]["message"]
    module = admin.create_item("Signal Processing Module")
    r = admin.post(f"/items/{rig['id']}/link", json={"parent_id": module["id"]})
    assert "cannot go inside" in r.json()["error"]["message"]


def test_moving_a_container_drags_its_contents_and_contents_cannot_move_alone(admin):
    rig = admin.create_item("Flight Rig")
    module = admin.create_item("Signal Processing Module")
    card = admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{card['id']}/link", json={"parent_id": module["id"]})
    admin.ok("POST", f"/items/{module['id']}/link", json={"parent_id": rig["id"]})
    lab = admin.location("Lab B")
    admin.ok("POST", f"/items/{rig['id']}/move", json={"location_id": lab["id"]})
    card = admin.ok("GET", f"/items/{card['id']}")
    assert card["location"]["name"] == "Lab B"
    assert card["storage"] == "assembled"
    assert [a["serial"] for a in card["ancestors"]] == [module["serial"], rig["serial"]]
    r = admin.post(f"/items/{card['id']}/move", json={"location_id": lab["id"]})
    assert r.status_code == 400 and "no location of its own" in r.json()["error"]["message"]


def test_unlinking_keeps_the_location_unless_told_otherwise(admin):
    module = admin.create_item("Signal Processing Module")
    admin.ok("POST", f"/items/{module['id']}/move",
             json={"location_id": admin.location("Lab A")["id"]})
    a, b = (admin.create_item("Power Regulator Board") for _ in range(2))
    for c in (a, b):
        admin.ok("POST", f"/items/{c['id']}/link", json={"parent_id": module["id"]})
    out = admin.ok("POST", f"/items/{a['id']}/unlink")
    assert out["parent"] is None and out["location"]["name"] == "Lab A"
    out = admin.ok("POST", f"/items/{b['id']}/unlink",
                   json={"location_id": admin.location("Desiccator B")["id"]})
    assert out["storage"] == "desiccator"
    assert admin.post(f"/items/{b['id']}/unlink").status_code == 400


def test_create_with_a_parent_and_with_contents(admin):
    module = admin.create_item("Signal Processing Module")
    card = admin.create_item("Power Regulator Board")
    rig = admin.create_item("Flight Rig", child_ids=[module["id"], card["id"]])
    assert sorted(c["serial"] for c in rig["children"]) == sorted([module["serial"],
                                                                   card["serial"]])


def test_composition_minimums_and_maximums(admin):
    module = admin.create_item("Signal Processing Module")
    assert module["is_complete"] is False
    assert module["missing_children"] == 1
    cards = [admin.create_item("Power Regulator Board") for _ in range(3)]
    admin.ok("POST", f"/items/{cards[0]['id']}/link", json={"parent_id": module["id"]})
    module = admin.ok("GET", f"/items/{module['id']}")
    assert module["is_complete"] is True
    admin.ok("POST", f"/items/{cards[1]['id']}/link", json={"parent_id": module["id"]})
    r = admin.post(f"/items/{cards[2]['id']}/link", json={"parent_id": module["id"]})
    assert r.status_code == 400 and "at most 2" in r.json()["error"]["message"]
    row = admin.ok("GET", f"/items/{module['id']}")["composition"][0]
    assert (row["count"], row["is_full"]) == (2, True)
    # a destroyed unit takes no place; bringing it back must fit again
    admin.ok("POST", f"/items/{cards[1]['id']}/state", json={"state": "destroyed"})
    admin.ok("POST", f"/items/{cards[2]['id']}/link", json={"parent_id": module["id"]})
    r = admin.post(f"/items/{cards[1]['id']}/state", json={"state": "ok"})
    assert r.status_code == 400


def test_set_contents_is_validated_as_a_whole(admin):
    module = admin.create_item("Signal Processing Module")
    cards = [admin.create_item("Power Regulator Board") for _ in range(3)]
    ids = [c["id"] for c in cards]
    r = admin.put(f"/items/{module['id']}/children", json={"child_ids": ids})
    assert r.status_code == 400
    assert admin.ok("GET", f"/items/{module['id']}")["children"] == []
    out = admin.ok("PUT", f"/items/{module['id']}/children", json={"child_ids": ids[:2]})
    assert len(out["children"]) == 2
    out = admin.ok("PUT", f"/items/{module['id']}/children", json={"child_ids": [ids[2]]})
    assert [c["id"] for c in out["children"]] == [ids[2]]
    assert admin.ok("GET", f"/items/{ids[0]}")["parent"] is None


def test_cycles_are_refused(admin):
    rig = admin.create_item("Flight Rig")
    r = admin.post(f"/items/{rig['id']}/link", json={"parent_id": rig["id"]})
    assert r.status_code == 400


def test_deleting_a_container_keeps_its_contents(admin):
    module = admin.create_item("Signal Processing Module")
    card = admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{card['id']}/link", json={"parent_id": module["id"]})
    admin.ok("DELETE", f"/items/{module['id']}", status=204)
    assert admin.ok("GET", f"/items/{card['id']}")["parent"] is None


def test_graphs(admin):
    rig = admin.create_item("Flight Rig")
    module = admin.create_item("Signal Processing Module")
    card = admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{card['id']}/link", json={"parent_id": module["id"]})
    admin.ok("POST", f"/items/{module['id']}/link", json={"parent_id": rig["id"]})

    tg = admin.ok("GET", "/graph/templates")
    names = {n["id"]: n["label"] for n in tg["nodes"]}
    assert [names[r] for r in tg["roots"]] == ["Flight Rig"]
    assert any(e["min_count"] == 1 and e["max_count"] == 2 for e in tg["edges"])

    trees = admin.ok("GET", f"/graph/items?template_id={rig['template']['id']}")
    assert {n["serial"] for n in trees["nodes"]} == {rig["serial"], module["serial"],
                                                     card["serial"]}
    one = admin.ok("GET", f"/items/{card['id']}/tree")
    assert one["roots"] == [rig["id"]] and one["focus"] == card["id"]
