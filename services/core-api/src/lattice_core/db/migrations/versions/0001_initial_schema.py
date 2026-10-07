"""Initial schema.

Enum columns are checked VARCHARs (each sa.Enum creates its own CHECK constraint).

Revision ID: 0001
Revises: 
Create Date: 2026-10-07 12:51:44.872206
"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('catalog_options',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('category', sa.Enum('project', 'industry', 'team', name='catalog_category', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('value', sa.String(length=255), nullable=False),
    sa.Column('description', sa.String(length=512), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_catalog_options')),
    sa.UniqueConstraint('category', 'value', name='uq_catalog_category_value')
    )
    with op.batch_alter_table('catalog_options', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_catalog_options_category'), ['category'], unique=False)
        batch_op.create_index(batch_op.f('ix_catalog_options_value'), ['value'], unique=False)

    op.create_table('locations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('building', sa.String(length=255), nullable=True),
    sa.Column('room', sa.String(length=255), nullable=True),
    sa.Column('x', sa.Double(), nullable=False),
    sa.Column('y', sa.Double(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('is_desiccator', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_locations'))
    )
    with op.batch_alter_table('locations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_locations_is_desiccator'), ['is_desiccator'], unique=False)
        batch_op.create_index(batch_op.f('ix_locations_name'), ['name'], unique=True)

    op.create_table('map_buildings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('x', sa.Double(), nullable=False),
    sa.Column('y', sa.Double(), nullable=False),
    sa.Column('width', sa.Double(), nullable=False),
    sa.Column('height', sa.Double(), nullable=False),
    sa.Column('color', sa.String(length=32), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_map_buildings'))
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('viewer', 'editor', 'manager', name='user_role', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('login_hint_visible', sa.Boolean(), nullable=False),
    sa.Column('login_hint_password', sa.String(length=255), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)

    op.create_table('catalog_links',
    sa.Column('option_a_id', sa.Integer(), nullable=False),
    sa.Column('option_b_id', sa.Integer(), nullable=False),
    sa.CheckConstraint('option_a_id < option_b_id', name=op.f('ck_catalog_links_ordered_pair')),
    sa.ForeignKeyConstraint(['option_a_id'], ['catalog_options.id'], name=op.f('fk_catalog_links_option_a_id_catalog_options'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['option_b_id'], ['catalog_options.id'], name=op.f('fk_catalog_links_option_b_id_catalog_options'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('option_a_id', 'option_b_id', name=op.f('pk_catalog_links'))
    )
    with op.batch_alter_table('catalog_links', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_catalog_links_option_b_id'), ['option_b_id'], unique=False)

    op.create_table('field_groups',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_field_groups_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_field_groups'))
    )
    with op.batch_alter_table('field_groups', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_field_groups_name'), ['name'], unique=True)

    op.create_table('item_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type', sa.Enum('setup', 'assembly', 'card', name='item_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('card_type', sa.Enum('copied', 'house', 'white', 'factory', 'commercial', name='card_type', native_enum=False, create_constraint=True, length=32), nullable=True),
    sa.Column('serial_prefix', sa.String(length=3), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("(type = 'card' AND card_type IS NOT NULL) OR (type <> 'card' AND card_type IS NULL)", name=op.f('ck_item_templates_card_type_only_on_cards')),
    sa.CheckConstraint('length(serial_prefix) = 3', name=op.f('ck_item_templates_serial_prefix_len')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_item_templates_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_item_templates')),
    sa.UniqueConstraint('type', 'name', name='uq_item_templates_type_name'),
    sa.UniqueConstraint('type', 'serial_prefix', name='uq_item_templates_type_prefix')
    )
    with op.batch_alter_table('item_templates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_item_templates_card_type'), ['card_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_item_templates_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_item_templates_type'), ['type'], unique=False)

    op.create_table('field_group_fields',
    sa.Column('group_id', sa.Integer(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('required', sa.Boolean(), nullable=False),
    sa.Column('config', sa.JSON(), nullable=False),
    sa.Column('fixed_value', sa.JSON(), nullable=True),
    sa.Column('field_type', sa.Enum('text', 'description', 'string', 'serial_string', 'link', 'enum', 'letter', 'date', 'integer', 'decimal', 'boolean', 'files', 'industry', 'project', 'team', 'managers', 'responsible', 'location', 'parent', 'status', 'quantity', name='field_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('mode', sa.Enum('fixed', 'choice', 'item', name='field_mode', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.ForeignKeyConstraint(['group_id'], ['field_groups.id'], name=op.f('fk_field_group_fields_group_id_field_groups'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_field_group_fields')),
    sa.UniqueConstraint('group_id', 'key', name='uq_field_group_fields_key')
    )
    with op.batch_alter_table('field_group_fields', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_field_group_fields_group_id'), ['group_id'], unique=False)

    op.create_table('items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.Column('type', sa.Enum('setup', 'assembly', 'card', name='item_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('serial', sa.String(length=64), nullable=False),
    sa.Column('state', sa.Enum('built', 'ok', 'faulty', 'destroyed', name='item_state', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('location_id', sa.Integer(), nullable=True),
    sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
    sa.Column('industry_id', sa.Integer(), nullable=True),
    sa.Column('project_id', sa.Integer(), nullable=True),
    sa.Column('team_id', sa.Integer(), nullable=True),
    sa.Column('responsible_id', sa.Integer(), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('quantity >= 1', name=op.f('ck_items_quantity_positive')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_items_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['industry_id'], ['catalog_options.id'], name=op.f('fk_items_industry_id_catalog_options'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['location_id'], ['locations.id'], name=op.f('fk_items_location_id_locations'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['parent_id'], ['items.id'], name=op.f('fk_items_parent_id_items'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['project_id'], ['catalog_options.id'], name=op.f('fk_items_project_id_catalog_options'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['responsible_id'], ['users.id'], name=op.f('fk_items_responsible_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['team_id'], ['catalog_options.id'], name=op.f('fk_items_team_id_catalog_options'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_items_template_id_item_templates'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_items'))
    )
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_items_industry_id'), ['industry_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_location_id'), ['location_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_parent_id'), ['parent_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_project_id'), ['project_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_responsible_id'), ['responsible_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_serial'), ['serial'], unique=True)
        batch_op.create_index(batch_op.f('ix_items_state'), ['state'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_team_id'), ['team_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_template_id'), ['template_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_items_type'), ['type'], unique=False)

    op.create_table('stock_thresholds',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.Column('min_quantity', sa.Integer(), nullable=False),
    sa.Column('notify_email', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_stock_thresholds_template_id_item_templates'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stock_thresholds'))
    )
    with op.batch_alter_table('stock_thresholds', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stock_thresholds_template_id'), ['template_id'], unique=True)

    op.create_table('template_children',
    sa.Column('parent_template_id', sa.Integer(), nullable=False),
    sa.Column('child_template_id', sa.Integer(), nullable=False),
    sa.Column('min_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('max_count', sa.Integer(), nullable=True),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.CheckConstraint('max_count IS NULL OR (max_count >= 1 AND max_count >= min_count)', name=op.f('ck_template_children_max_count_valid')),
    sa.CheckConstraint('min_count >= 0', name=op.f('ck_template_children_min_count_non_negative')),
    sa.CheckConstraint('parent_template_id <> child_template_id', name=op.f('ck_template_children_not_self')),
    sa.ForeignKeyConstraint(['child_template_id'], ['item_templates.id'], name=op.f('fk_template_children_child_template_id_item_templates'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['parent_template_id'], ['item_templates.id'], name=op.f('fk_template_children_parent_template_id_item_templates'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('parent_template_id', 'child_template_id', name=op.f('pk_template_children'))
    )
    with op.batch_alter_table('template_children', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_template_children_child_template_id'), ['child_template_id'], unique=False)

    op.create_table('template_fields',
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('required', sa.Boolean(), nullable=False),
    sa.Column('config', sa.JSON(), nullable=False),
    sa.Column('fixed_value', sa.JSON(), nullable=True),
    sa.Column('field_type', sa.Enum('text', 'description', 'string', 'serial_string', 'link', 'enum', 'letter', 'date', 'integer', 'decimal', 'boolean', 'files', 'industry', 'project', 'team', 'managers', 'responsible', 'location', 'parent', 'status', 'quantity', name='field_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('mode', sa.Enum('fixed', 'choice', 'item', name='field_mode', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_template_fields_template_id_item_templates'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_template_fields')),
    sa.UniqueConstraint('template_id', 'key', name='uq_template_fields_key')
    )
    with op.batch_alter_table('template_fields', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_template_fields_template_id'), ['template_id'], unique=False)

    op.create_table('audit_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=True),
    sa.Column('template_id', sa.Integer(), nullable=True),
    sa.Column('subject', sa.String(length=255), nullable=True),
    sa.Column('action', sa.String(length=64), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('user_name', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_audit_log_item_id_items'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_audit_log_template_id_item_templates'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_log_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_log'))
    )
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_log_action'), ['action'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_item_id'), ['item_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_template_id'), ['template_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_user_id'), ['user_id'], unique=False)

    op.create_table('change_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('action', sa.Enum('create', 'update', 'delete', 'move', 'link', 'unlink', 'state_change', 'template_create', 'template_update', name='change_action', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=True),
    sa.Column('template_id', sa.Integer(), nullable=True),
    sa.Column('item_type', sa.Enum('setup', 'assembly', 'card', name='item_type', native_enum=False, create_constraint=True, length=32), nullable=True),
    sa.Column('target_name', sa.String(length=255), nullable=True),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('pending', 'approved', 'rejected', name='change_status', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('proposed_by', sa.Integer(), nullable=False),
    sa.Column('reviewed_by', sa.Integer(), nullable=True),
    sa.Column('review_note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_change_requests_item_id_items'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['proposed_by'], ['users.id'], name=op.f('fk_change_requests_proposed_by_users'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name=op.f('fk_change_requests_reviewed_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_change_requests_template_id_item_templates'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_change_requests'))
    )
    with op.batch_alter_table('change_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_change_requests_item_id'), ['item_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_change_requests_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_change_requests_template_id'), ['template_id'], unique=False)

    op.create_table('documents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=True),
    sa.Column('template_id', sa.Integer(), nullable=True),
    sa.Column('field_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('doc_type', sa.String(length=64), nullable=True),
    sa.Column('url', sa.String(length=1024), nullable=True),
    sa.Column('storage_key', sa.String(length=255), nullable=True),
    sa.Column('original_filename', sa.String(length=255), nullable=True),
    sa.Column('content_type', sa.String(length=255), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('uploaded_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('url IS NOT NULL OR storage_key IS NOT NULL', name=op.f('ck_documents_has_content')),
    sa.ForeignKeyConstraint(['field_id'], ['template_fields.id'], name=op.f('fk_documents_field_id_template_fields'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_documents_item_id_items'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['template_id'], ['item_templates.id'], name=op.f('fk_documents_template_id_item_templates'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_documents_uploaded_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_documents')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_documents_storage_key'))
    )
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_documents_field_id'), ['field_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_documents_item_id'), ['item_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_documents_template_id'), ['template_id'], unique=False)

    op.create_table('extra_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('setup_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('company_part_number', sa.String(length=128), nullable=True),
    sa.Column('serial', sa.String(length=128), nullable=True),
    sa.Column('signed_by', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['setup_id'], ['items.id'], name=op.f('fk_extra_items_setup_id_items'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_extra_items'))
    )
    with op.batch_alter_table('extra_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_extra_items_setup_id'), ['setup_id'], unique=False)

    op.create_table('item_field_values',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('field_id', sa.Integer(), nullable=False),
    sa.Column('value', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['field_id'], ['template_fields.id'], name=op.f('fk_item_field_values_field_id_template_fields'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_item_field_values_item_id_items'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_item_field_values')),
    sa.UniqueConstraint('item_id', 'field_id', name='uq_item_field_values_item_field')
    )
    with op.batch_alter_table('item_field_values', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_item_field_values_field_id'), ['field_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_item_field_values_item_id'), ['item_id'], unique=False)

    op.create_table('item_managers',
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_item_managers_item_id_items'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_item_managers_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('item_id', 'user_id', name=op.f('pk_item_managers'))
    )
    op.create_table('state_history',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('state', sa.Enum('built', 'ok', 'faulty', 'destroyed', name='item_state', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('changed_by', sa.Integer(), nullable=True),
    sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['changed_by'], ['users.id'], name=op.f('fk_state_history_changed_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], name=op.f('fk_state_history_item_id_items'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_state_history'))
    )
    with op.batch_alter_table('state_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_state_history_item_id'), ['item_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('state_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_state_history_item_id'))

    op.drop_table('state_history')
    op.drop_table('item_managers')
    with op.batch_alter_table('item_field_values', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_item_field_values_item_id'))
        batch_op.drop_index(batch_op.f('ix_item_field_values_field_id'))

    op.drop_table('item_field_values')
    with op.batch_alter_table('extra_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_extra_items_setup_id'))

    op.drop_table('extra_items')
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_documents_template_id'))
        batch_op.drop_index(batch_op.f('ix_documents_item_id'))
        batch_op.drop_index(batch_op.f('ix_documents_field_id'))

    op.drop_table('documents')
    with op.batch_alter_table('change_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_change_requests_template_id'))
        batch_op.drop_index(batch_op.f('ix_change_requests_status'))
        batch_op.drop_index(batch_op.f('ix_change_requests_item_id'))

    op.drop_table('change_requests')
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_log_user_id'))
        batch_op.drop_index(batch_op.f('ix_audit_log_template_id'))
        batch_op.drop_index(batch_op.f('ix_audit_log_item_id'))
        batch_op.drop_index(batch_op.f('ix_audit_log_created_at'))
        batch_op.drop_index(batch_op.f('ix_audit_log_action'))

    op.drop_table('audit_log')
    with op.batch_alter_table('template_fields', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_template_fields_template_id'))

    op.drop_table('template_fields')
    with op.batch_alter_table('template_children', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_template_children_child_template_id'))

    op.drop_table('template_children')
    with op.batch_alter_table('stock_thresholds', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stock_thresholds_template_id'))

    op.drop_table('stock_thresholds')
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_items_type'))
        batch_op.drop_index(batch_op.f('ix_items_template_id'))
        batch_op.drop_index(batch_op.f('ix_items_team_id'))
        batch_op.drop_index(batch_op.f('ix_items_state'))
        batch_op.drop_index(batch_op.f('ix_items_serial'))
        batch_op.drop_index(batch_op.f('ix_items_responsible_id'))
        batch_op.drop_index(batch_op.f('ix_items_project_id'))
        batch_op.drop_index(batch_op.f('ix_items_parent_id'))
        batch_op.drop_index(batch_op.f('ix_items_location_id'))
        batch_op.drop_index(batch_op.f('ix_items_industry_id'))

    op.drop_table('items')
    with op.batch_alter_table('field_group_fields', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_field_group_fields_group_id'))

    op.drop_table('field_group_fields')
    with op.batch_alter_table('item_templates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_item_templates_type'))
        batch_op.drop_index(batch_op.f('ix_item_templates_name'))
        batch_op.drop_index(batch_op.f('ix_item_templates_card_type'))

    op.drop_table('item_templates')
    with op.batch_alter_table('field_groups', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_field_groups_name'))

    op.drop_table('field_groups')
    with op.batch_alter_table('catalog_links', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_catalog_links_option_b_id'))

    op.drop_table('catalog_links')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_email'))

    op.drop_table('users')
    op.drop_table('map_buildings')
    with op.batch_alter_table('locations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_locations_name'))
        batch_op.drop_index(batch_op.f('ix_locations_is_desiccator'))

    op.drop_table('locations')
    with op.batch_alter_table('catalog_options', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_catalog_options_value'))
        batch_op.drop_index(batch_op.f('ix_catalog_options_category'))

    op.drop_table('catalog_options')
