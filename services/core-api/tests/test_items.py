from lattice_core.domain.enums import FieldMode, FieldType

from conftest import field


def test_items_are_made_only_from_a_template(admin):
    r = admin.post("/items", json={"template_id": 9999})
    assert r.status_code == 400
    assert "template" in r.json()["error"]["message"]


def test_serials_are_issued_per_template_and_stay_unique(admin):
    a = admin.create_item("Power Regulator Board")
    b = admin.create_item("Power Regulator Board")
    assert (a["serial"], b["serial"]) == ("C-PRB-001", "C-PRB-002")
    c = admin.create_item("Power Regulator Board", serial="c-prb-010")
    assert c["serial"] == "C-PRB-010"
    assert admin.create_item("Power Regulator Board")["serial"] == "C-PRB-011"
    for bad, word in (("C-PRB-010", "already used"), ("A-PRB-001", "starts with"),
                      ("C-XYZ-001", "prefix"), ("PRB-1", "not a valid serial")):
        r = admin.post("/items", json={"template_id": a["template"]["id"], "serial": bad})
        assert r.status_code == 400 and word in r.json()["error"]["message"], (bad, r.text)
    r = admin.patch(f"/items/{a['id']}", json={"serial": "C-PRB-002"})
    assert r.status_code == 400


def test_new_items_are_built_and_new_cards_start_in_the_desiccator(admin):
    item = admin.create_item("Power Regulator Board")
    assert item["state"] == "built"
    assert item["location"]["name"] == "Desiccator A"
    assert item["storage"] == "desiccator"
    assert item["state_history"][0]["note"] == "Item created"


def test_a_list_field_defaults_to_its_head_and_refuses_other_values(admin):
    item = admin.create_item("Power Regulator Board")
    assert item["project"]["value"] == "Falcon"
    space = admin.catalog("Space")
    r = admin.post("/items", json={"template_id": item["template"]["id"],
                                   "values": {"project": space["id"]}})
    assert r.status_code == 400


def test_template_values_cannot_be_set_per_item(admin):
    tpl = admin.template("Power Regulator Board")
    r = admin.post("/items", json={"template_id": tpl["id"], "values": {"managers": []}})
    assert r.json()["error"]["issues"][0]["field"] == "managers"


def test_every_invalid_value_is_reported_at_once(admin):
    tpl = admin.template("Power Regulator Board")
    r = admin.post("/items", json={"template_id": tpl["id"],
                                   "values": {"revision": "abc", "location": "Mars", "nope": 1}})
    body = r.json()["error"]
    assert body["code"] == "validation_failed"
    assert {i["field"] for i in body["issues"]} == {"revision", "location", "nope"}


def test_formats_fill_in_the_fixed_characters(admin):
    item = admin.create_item("Power Regulator Board", values={"revision": "07"})
    assert next(f for f in item["fields"] if f["key"] == "revision")["value"] == "RV-07"


def test_only_commercial_cards_carry_a_quantity(admin):
    item = admin.create_item("Resistor Pack", values={"quantity": 25})
    assert item["quantity"] == 25
    r = admin.post("/items", json={"template_id": item["template"]["id"],
                                   "values": {"quantity": 0}})
    assert r.status_code == 400
    r = admin.post("/items", json={"template_id": item["template"]["id"]})
    assert "required" in r.json()["error"]["issues"][0]["message"]


def test_managers_fields_accept_managers_only(admin):
    dana = admin.user("dana@lattice.io")
    r = admin.post("/templates", json={
        "type": "card", "name": "M", "card_type": "white", "serial_prefix": "MMM",
        "fields": [field("Managers", FieldType.MANAGERS, FieldMode.FIXED,
                         fixed_value=[dana["id"]])]})
    assert "not a manager" in r.json()["error"]["issues"][0]["message"]


def test_physical_state_is_not_edited_through_the_edit_form(admin):
    item = admin.create_item("Power Regulator Board")
    r = admin.patch(f"/items/{item['id']}",
                    json={"values": {"location": admin.location("Lab A")["id"]}})
    assert r.status_code == 400
    assert "move" in r.json()["error"]["issues"][0]["message"]


def test_a_no_op_save_writes_no_audit_entry(admin):
    item = admin.create_item("Power Regulator Board", values={"revision": "01"})
    before = admin.ok("GET", f"/audit?item_id={item['id']}")["total"]
    admin.ok("PATCH", f"/items/{item['id']}", json={"values": {"revision": "RV-01"}})
    assert admin.ok("GET", f"/audit?item_id={item['id']}")["total"] == before


def test_state_changes_into_and_out_of_faulty_need_a_note(admin):
    item = admin.create_item("Power Regulator Board")
    r = admin.post(f"/items/{item['id']}/state", json={"state": "faulty"})
    assert r.status_code == 400
    item = admin.ok("POST", f"/items/{item['id']}/state",
                    json={"state": "faulty", "note": "Smoke on U3"})
    assert [h["state"] for h in item["state_history"]] == ["built", "faulty"]
    assert admin.post(f"/items/{item['id']}/state", json={"state": "ok"}).status_code == 400


def test_list_items_is_paged_and_filterable(admin):
    for _ in range(3):
        admin.create_item("Power Regulator Board")
    admin.create_item("Resistor Pack", values={"quantity": 2})
    page = admin.ok("GET", "/items?type=card&limit=2")
    assert (page["total"], len(page["items"]), page["limit"]) == (4, 2, 2)
    assert admin.ok("GET", "/items?q=resistor")["total"] == 1
    assert admin.ok("GET", "/items?storage=desiccator")["total"] == 4
    assert admin.ok("GET", "/items?storage=in_use")["total"] == 0
    row = admin.ok("GET", "/items?q=C-PRB-001")["items"][0]
    assert row["template"]["serial_prefix"] == "PRB"
    assert row["location"]["is_desiccator"] is True


def test_bulk_actions_are_all_or_nothing(admin):
    a = admin.create_item("Power Regulator Board")
    b = admin.create_item("Power Regulator Board")
    lab = admin.location("Lab A")
    r = admin.post("/items/bulk", json={"action": "move", "item_ids": [a["id"], b["id"], 999],
                                        "location_id": lab["id"]})
    assert r.status_code == 404
    assert admin.ok("GET", f"/items/{a['id']}")["location"]["name"] == "Desiccator A"
    out = admin.ok("POST", "/items/bulk", json={"action": "move", "item_ids": [a["id"], b["id"]],
                                                "location_id": lab["id"]})
    assert out == {"processed": 2}
    # a failure halfway rolls the first change back
    r = admin.post("/items/bulk", json={"action": "state_change", "state": "faulty",
                                        "item_ids": [a["id"], b["id"]]})
    assert r.status_code == 400
    assert admin.ok("GET", f"/items/{a['id']}")["state"] == "built"


def test_extras_belong_to_setups(admin):
    rig = admin.create_item("Flight Rig")
    extra = admin.ok("POST", f"/items/{rig['id']}/extras", status=201,
                     json={"name": "Power supply", "company_part_number": "PS-12"})
    assert admin.ok("GET", f"/items/{rig['id']}")["extras"][0]["name"] == "Power supply"
    card = admin.create_item("Power Regulator Board")
    assert admin.post(f"/items/{card['id']}/extras", json={"name": "x"}).status_code == 400
    admin.ok("DELETE", f"/items/{rig['id']}/extras/{extra['id']}", status=204)


def test_documents_are_real_uploads_or_links(world, admin):
    item = admin.create_item("Power Regulator Board")
    doc = admin.ok("POST", f"/items/{item['id']}/documents", status=201,
                   files={"file": ("report.txt", b"hello", "text/plain")},
                   data={"doc_type": "report"})
    assert doc["is_file"] and doc["size_bytes"] == 5
    viewer = world.as_("viewer")
    assert viewer.get(f"/documents/{doc['id']}/download").content == b"hello"
    link = admin.ok("POST", f"/items/{item['id']}/links", status=201,
                    json={"name": "Wiki", "url": "https://wiki.example/prb"})
    assert admin.get(f"/documents/{link['id']}/download").status_code == 400
    detail = admin.ok("GET", f"/items/{item['id']}")
    assert [d["name"] for d in detail["documents"]] == ["report.txt", "Wiki"]
    admin.ok("DELETE", f"/items/{item['id']}/documents/{doc['id']}", status=204)
    assert admin.get(f"/documents/{doc['id']}/download").status_code == 404


def test_a_files_field_takes_staged_uploads(world, admin):
    tpl = admin.ok("POST", "/templates", status=201, json={
        "type": "card", "name": "Doc Card", "card_type": "white", "serial_prefix": "DOC",
        "fields": [field("Photos", FieldType.FILES)]})
    editor = world.as_("editor")
    staged = editor.ok("POST", "/uploads", status=201,
                       files={"file": ("p.png", b"\x89PNG", "image/png")})
    item = admin.ok("POST", "/items", status=201,
                    json={"template_id": tpl["id"], "values": {"photos": [staged["id"]]}})
    photos = next(f for f in item["fields"] if f["key"] == "photos")
    assert photos["value"] == [staged["id"]]
    assert photos["display"][0]["name"] == "p.png"
    # a file can't be attached twice
    r = admin.post("/items", json={"template_id": tpl["id"], "values": {"photos": [staged["id"]]}})
    assert r.status_code == 400
    # removing it from the field deletes it
    admin.ok("PATCH", f"/items/{item['id']}", json={"values": {"photos": []}})
    assert admin.get(f"/documents/{staged['id']}/download").status_code == 404
