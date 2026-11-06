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
` }];
