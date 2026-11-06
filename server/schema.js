export const uniformesMigrations = [{ version: 1, sql: `
CREATE TABLE sectors(id TEXT PRIMARY KEY, label TEXT NOT NULL) STRICT;
CREATE TABLE employees(id TEXT PRIMARY KEY, name TEXT NOT NULL, registration TEXT NOT NULL UNIQUE) STRICT;
CREATE TABLE responsibles(id TEXT PRIMARY KEY, label TEXT NOT NULL) STRICT;
CREATE TABLE uniforms(id TEXT PRIMARY KEY, label TEXT NOT NULL, icon TEXT NOT NULL) STRICT;
CREATE TABLE variants(id TEXT PRIMARY KEY, uniform_id TEXT NOT NULL REFERENCES uniforms(id), color TEXT NOT NULL, size TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total>=0), available INTEGER NOT NULL CHECK(available>=0 AND available<=total), UNIQUE(uniform_id,color,size)) STRICT;
CREATE TABLE loans(id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL REFERENCES employees(id), sector_id TEXT NOT NULL REFERENCES sectors(id),
 responsible_id TEXT NOT NULL REFERENCES responsibles(id), loan_date TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE TABLE loan_items(id INTEGER PRIMARY KEY AUTOINCREMENT, loan_id INTEGER NOT NULL REFERENCES loans(id), variant_id TEXT NOT NULL REFERENCES variants(id),
 quantity INTEGER NOT NULL CHECK(quantity>0), held INTEGER NOT NULL CHECK(held>=0), dirty INTEGER NOT NULL DEFAULT 0 CHECK(dirty>=0),
 laundry INTEGER NOT NULL DEFAULT 0 CHECK(laundry>=0), clean INTEGER NOT NULL DEFAULT 0 CHECK(clean>=0), version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL, sent_at TEXT, CHECK(held+dirty+laundry+clean=quantity)) STRICT;
CREATE INDEX loan_items_loan ON loan_items(loan_id);
CREATE TABLE movements(id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER REFERENCES loan_items(id), variant_id TEXT NOT NULL REFERENCES variants(id),
 kind TEXT NOT NULL CHECK(kind IN ('opening','stock-add','loan','return','dispatch','receive')), quantity INTEGER NOT NULL CHECK(quantity>0), happened_at TEXT NOT NULL) STRICT;
CREATE TABLE drafts(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL) STRICT;
CREATE TABLE requests(key TEXT PRIMARY KEY, operation TEXT NOT NULL, hash TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
` }, { version: 2, sql: `
ALTER TABLE sectors ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE responsibles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE uniforms ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE opening_lots(
 id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id TEXT NOT NULL REFERENCES variants(id),
 employee_id TEXT REFERENCES employees(id), responsible_id TEXT REFERENCES responsibles(id), sector_id TEXT REFERENCES sectors(id), loan_date TEXT,
 quantity INTEGER NOT NULL CHECK(quantity>0), held INTEGER NOT NULL DEFAULT 0 CHECK(held>=0), dirty INTEGER NOT NULL DEFAULT 0 CHECK(dirty>=0),
 laundry INTEGER NOT NULL DEFAULT 0 CHECK(laundry>=0), clean INTEGER NOT NULL DEFAULT 0 CHECK(clean>=0), version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL, sent_at TEXT,
 CHECK(held+dirty+laundry+clean=quantity), CHECK(held=0 OR employee_id IS NOT NULL)
) STRICT;
CREATE INDEX opening_lots_variant ON opening_lots(variant_id);
ALTER TABLE movements ADD COLUMN opening_lot_id INTEGER REFERENCES opening_lots(id);
` }];
