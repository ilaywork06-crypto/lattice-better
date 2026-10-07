from lattice_core.domain.enums import FieldMode, FieldType

from conftest import field


def card(name="Test Card", prefix="TST", card_type="factory", fields=(), **extra):
    return {"type": "card", "name": name, "card_type": card_type, "serial_prefix": prefix,
            "fields": list(fields), **extra}


def test_template_rules_are_enforced(admin):
    def err(body, status=400):
        r = admin.post("/templates", json=body)
        assert r.status_code == status, r.text
        return r.json()["error"]

    assert "card type" in err(card(card_type=None))["message"]
    assert "Only card templates" in err({"type": "setup", "name": "S", "serial_prefix": "SSS",
                                         "card_type": "house"})["message"]
    assert "three Latin letters" in err(card(prefix="P1X"))["message"]
    assert err(card(name="power regulator board", prefix="ZZZ"), 409)["code"] == "conflict"
    assert "already used" in err(card(prefix="PRB"), 409)["message"]
    # every bad field is reported at once, each pinned to its position
    e = err(card(fields=[
        field("Qty", FieldType.QUANTITY),
        field("Where", FieldType.LOCATION, FieldMode.FIXED),
        field("Kind", FieldType.ENUM),
    ]))
    assert e["code"] == "validation_failed"
    assert [i["field"] for i in e["issues"]] == ["fields.0", "fields.1", "fields.2"]
    assert "commercial" in e["issues"][0]["message"]


def test_the_same_prefix_is_fine_across_types(admin):
    admin.ok("POST", "/templates", status=201,
             json={"type": "setup", "name": "PRB Setup", "serial_prefix": "PRB"})


def test_containers_hold_only_what_their_type_allows(admin):
    prb = admin.template("Power Regulator Board")
    setup = admin.template("Flight Rig")
    r = admin.post("/templates", json={"type": "assembly", "name": "Bad", "serial_prefix": "BAD",
                                       "children": [{"template_id": setup["id"]}]})
    assert r.status_code == 400
    assert "cannot contain setup" in r.json()["error"]["issues"][0]["message"]
    r = admin.post("/templates", json=card(children=[{"template_id": prb["id"]}]))
    assert r.status_code == 400


def test_detail_has_fields_children_and_the_next_serial(admin):
    spm = admin.ok("GET", f"/templates/{admin.template('Signal Processing Module')['id']}")
    assert spm["next_serial"] == "A-SPM-001"
    assert [(c["template"]["name"], c["min_count"], c["max_count"]) for c in spm["children"]] == [
        ("Power Regulator Board", 1, 2), ("Resistor Pack", 0, None)]
    prb = admin.ok("GET", f"/templates/{admin.template('Power Regulator Board')['id']}")
    managers = next(f for f in prb["fields"] if f["field_type"] == "managers")
    assert managers["fixed_display"] == ["Noa Manager"]
    project = next(f for f in prb["fields"] if f["field_type"] == "project")
    assert project["options_display"] == ["Falcon", "Sparrow"]
    assert [p["name"] for p in prb["parents"]] == ["Signal Processing Module", "Flight Rig"]


def test_counts_per_state_exclude_destroyed(admin):
    a = admin.create_item("Power Regulator Board")
    admin.create_item("Power Regulator Board")
    admin.ok("POST", f"/items/{a['id']}/state", json={"state": "destroyed"})
    counts = admin.template("Power Regulator Board")["counts"]
    assert counts == {"built": 1, "ok": 0, "faulty": 0, "destroyed": 1, "total": 1}


def test_fixed_managers_reach_every_item_and_follow_template_edits(admin):
    item = admin.create_item("Power Regulator Board")
    assert [m["full_name"] for m in item["managers"]] == ["Noa Manager"]
    tpl = admin.ok("GET", f"/templates/{item['template']['id']}")
    me = admin.ok("GET", "/auth/me")
    fields = [{**f, "fixed_value": [me["id"]]} if f["field_type"] == "managers" else f
              for f in tpl["fields"]]
    admin.ok("PATCH", f"/templates/{tpl['id']}", json={"fields": fields})
    item = admin.ok("GET", f"/items/{item['id']}")
    assert [m["full_name"] for m in item["managers"]] == ["System Administrator"]


def test_switching_a_fixed_field_to_per_item_keeps_each_items_value(admin):
    tpl = admin.ok("POST", "/templates", status=201, json=card(fields=[
        field("Vendor", FieldType.TEXT, FieldMode.FIXED, fixed_value="ACME")]))
    item = admin.create_item("Test Card")
    vendor = next(f for f in item["fields"] if f["key"] == "vendor")
    assert vendor["value"] == "ACME"
    fields = [{**tpl["fields"][0], "mode": "item"}]
    admin.ok("PATCH", f"/templates/{tpl['id']}", json={"fields": fields})
    item = admin.ok("GET", f"/items/{item['id']}")
    assert next(f for f in item["fields"] if f["key"] == "vendor")["value"] == "ACME"
    # and now it's editable per item
    admin.ok("PATCH", f"/items/{item['id']}", json={"values": {"vendor": "Other"}})


def test_a_field_type_cannot_change_in_place(admin):
    tpl = admin.ok("GET", f"/templates/{admin.template('Power Regulator Board')['id']}")
    fields = [{**f, "field_type": "text"} if f["key"] == "revision" else f for f in tpl["fields"]]
    r = admin.patch(f"/templates/{tpl['id']}", json={"fields": fields})
    assert r.status_code == 400
    assert "cannot change" in r.json()["error"]["issues"][0]["message"]


def test_a_template_with_items_cannot_be_deleted(admin):
    item = admin.create_item("Resistor Pack", values={"quantity": 3})
    r = admin.delete(f"/templates/{item['template']['id']}")
    assert r.status_code == 409
    admin.ok("DELETE", f"/items/{item['id']}", status=204)
    admin.ok("DELETE", f"/templates/{item['template']['id']}", status=204)


def test_contents_limits_cannot_drop_below_what_items_hold(admin):
    spm = admin.template("Signal Processing Module")
    prb = admin.template("Power Regulator Board")
    res = admin.template("Resistor Pack")
    a = admin.create_item("Signal Processing Module")
    for _ in range(2):
        c = admin.create_item("Power Regulator Board")
        admin.ok("POST", f"/items/{c['id']}/link", json={"parent_id": a["id"]})
    r = admin.patch(f"/templates/{spm['id']}", json={"children": [
        {"template_id": prb["id"], "max_count": 1}, {"template_id": res["id"]}]})
    assert r.status_code == 409
    r = admin.patch(f"/templates/{spm['id']}", json={"children": [{"template_id": res["id"]}]})
    assert r.status_code == 409
    assert "unlink them" in r.json()["error"]["message"]


def test_reordering_children_keeps_their_limits(admin):
    spm = admin.template("Signal Processing Module")
    prb = admin.template("Power Regulator Board")
    res = admin.template("Resistor Pack")
    out = admin.ok("PATCH", f"/templates/{spm['id']}", json={"children": [
        {"template_id": res["id"], "max_count": 5},
        {"template_id": prb["id"], "min_count": 1, "max_count": 2}]})
    assert [(c["template"]["name"], c["max_count"]) for c in out["children"]] == [
        ("Resistor Pack", 5), ("Power Regulator Board", 2)]


def test_duplicating_a_template_copies_its_shared_files(admin):
    src = admin.ok("POST", "/templates", status=201, json=card(fields=[
        field("Datasheets", FieldType.FILES, FieldMode.FIXED)]))
    fid = src["fields"][0]["id"]
    admin.ok("POST", f"/templates/{src['id']}/fields/{fid}/files", status=201,
             files={"file": ("sheet.pdf", b"%PDF-1.4 data", "application/pdf")})
    dup = admin.ok("POST", "/templates", status=201, json=card(
        name="Test Card Mk2", prefix="TSB", source_template_id=src["id"],
        fields=[{**field("Datasheets", FieldType.FILES, FieldMode.FIXED),
                 "copy_files_from": fid}]))
    files = dup["fields"][0]["files"]
    assert [f["name"] for f in files] == ["sheet.pdf"]
    src = admin.ok("GET", f"/templates/{src['id']}")
    assert files[0]["id"] != src["fields"][0]["files"][0]["id"]  # its own copy
    blob = admin.get(f"/documents/{files[0]['id']}/download")
    assert blob.content == b"%PDF-1.4 data"


def test_field_groups_are_reusable_and_validated(world, admin):
    g = admin.ok("POST", "/field-groups", status=201, json={
        "name": "Traceability", "description": "Where it came from",
        "fields": [field("Made on", FieldType.DATE), field("Supplier", FieldType.TEXT)]})
    assert [f["key"] for f in g["fields"]] == ["made_on", "supplier"]
    assert admin.post("/field-groups", json={"name": "traceability", "fields": [
        field("X", FieldType.TEXT)]}).status_code == 409
    assert [x["name"] for x in admin.ok("GET", "/field-groups?search=suppl")] == ["Traceability"]
    assert world.as_("editor").post("/field-groups", json={
        "name": "E", "fields": [field("X", FieldType.TEXT)]}).status_code == 403
    admin.ok("PATCH", f"/field-groups/{g['id']}", json={"fields": [field("Lot", FieldType.TEXT)]})
    assert [f["label"] for f in admin.ok("GET", f"/field-groups/{g['id']}")["fields"]] == ["Lot"]
    admin.ok("DELETE", f"/field-groups/{g['id']}", status=204)
