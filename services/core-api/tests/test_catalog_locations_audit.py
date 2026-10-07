def test_catalog_links_are_two_way_and_cross_category(world, admin):
    team = admin.catalog("HW-Team-A")
    avionics, space = admin.catalog("Avionics"), admin.catalog("Space")
    out = admin.ok("PUT", f"/catalog/{team['id']}/links",
                   json={"category": "industry", "option_ids": [avionics["id"], space["id"]]})
    assert out["linked_ids"] == sorted([avionics["id"], space["id"]])
    assert admin.catalog("Space")["linked_ids"] == [team["id"]]
    r = admin.put(f"/catalog/{team['id']}/links", json={"category": "team", "option_ids": []})
    assert r.status_code == 400
    assert world.as_("editor").put(f"/catalog/{team['id']}/links",
                                   json={"category": "industry"}).status_code == 403


def test_catalog_values_in_use_are_protected_and_renames_follow(admin):
    item = admin.create_item("Power Regulator Board")
    falcon = admin.catalog("Falcon")
    assert falcon["usage_count"] == 1
    assert admin.delete(f"/catalog/{falcon['id']}").status_code == 409
    admin.ok("PATCH", f"/catalog/{falcon['id']}", json={"value": "Falcon II"})
    assert admin.ok("GET", f"/items/{item['id']}")["project"]["value"] == "Falcon II"
    admin.ok("DELETE", f"/items/{item['id']}", status=204)
    r = admin.delete(f"/catalog/{falcon['id']}")
    assert r.status_code == 409 and "template" in r.json()["error"]["message"]
    other = admin.ok("POST", "/catalog", status=201, json={"category": "team", "value": "Ops"})
    admin.ok("DELETE", f"/catalog/{other['id']}", status=204)


def test_locations(world, admin):
    editor = world.as_("editor")
    loc = editor.ok("POST", "/locations", status=201, json={"name": "Lab C", "x": 10, "y": 90})
    assert editor.post("/locations", json={"name": " lab c "}).status_code == 409
    assert editor.post("/locations", json={"name": "D", "is_desiccator": True}).status_code == 403
    assert editor.patch(f"/locations/{loc['id']}",
                        json={"is_desiccator": True}).status_code == 403
    assert editor.delete(f"/locations/{loc['id']}").status_code == 403
    admin.create_item("Power Regulator Board")
    des = admin.location("Desiccator A")
    assert des["item_count"] == 1
    assert admin.delete(f"/locations/{des['id']}").status_code == 409
    admin.ok("DELETE", f"/locations/{loc['id']}", status=204)


def test_map_buildings(world, admin):
    viewer, editor = world.as_("viewer"), world.as_("editor")
    assert [b["name"] for b in viewer.ok("GET", "/map/buildings")] == ["Building 1"]
    b = editor.ok("POST", "/map/buildings", status=201, json={"name": "Hall", "x": 60, "y": 60})
    editor.ok("PATCH", f"/map/buildings/{b['id']}", json={"width": 12})
    assert viewer.post("/map/buildings", json={"name": "x"}).status_code == 403
    assert editor.delete(f"/map/buildings/{b['id']}").status_code == 403
    admin.ok("DELETE", f"/map/buildings/{b['id']}", status=204)


def test_audit_my_items_and_periods(world, admin):
    noa = world.as_("manager")
    mine = admin.create_item("Power Regulator Board")      # Noa manages these boards
    admin.create_item("Resistor Pack", values={"quantity": 1})
    entries = noa.ok("GET", "/audit?mine=true")["items"]
    assert entries and {e["item_id"] for e in entries} == {mine["id"]}
    assert world.as_("editor").ok("GET", "/audit?mine=true")["total"] == 0
    assert admin.ok("GET", "/audit?period=day")["total"] >= 2
    assert admin.ok("GET", "/audit?q=resistor")["total"] >= 1
    r = admin.get("/audit/export?period=week")
    assert r.status_code == 200 and r.content[:2] == b"PK"


def test_search_ranks_and_treats_wildcards_literally(world, admin):
    item = admin.create_item("Power Regulator Board")
    res = admin.ok("GET", f"/search?q={item['serial']}")
    assert res["items"][0]["id"] == item["id"]
    assert admin.ok("GET", "/search?q=regulator")["templates"][0]["title"] == \
        "Power Regulator Board"
    assert admin.ok("GET", "/search?q=%25")["items"] == []
    assert admin.ok("GET", "/search?q=noa")["users"]
    assert world.as_("editor").ok("GET", "/search?q=noa")["users"] == []
