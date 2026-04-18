CREATE TABLE IF NOT EXISTS content_search (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  type TEXT,
  subtype TEXT,
  tags_text TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_content_search_collection_slug
  ON content_search(collection, slug);

CREATE VIRTUAL TABLE IF NOT EXISTS content_search_fts USING fts5(
  title,
  summary,
  slug,
  type,
  subtype,
  tags_text,
  body_text,
  content='content_search',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS content_search_ai AFTER INSERT ON content_search BEGIN
  INSERT INTO content_search_fts(rowid, title, summary, slug, type, subtype, tags_text, body_text)
  VALUES (new.rowid, new.title, new.summary, new.slug, new.type, new.subtype, new.tags_text, new.body_text);
END;

CREATE TRIGGER IF NOT EXISTS content_search_ad AFTER DELETE ON content_search BEGIN
  INSERT INTO content_search_fts(content_search_fts, rowid, title, summary, slug, type, subtype, tags_text, body_text)
  VALUES ('delete', old.rowid, old.title, old.summary, old.slug, old.type, old.subtype, old.tags_text, old.body_text);
END;

CREATE TRIGGER IF NOT EXISTS content_search_au AFTER UPDATE ON content_search BEGIN
  INSERT INTO content_search_fts(content_search_fts, rowid, title, summary, slug, type, subtype, tags_text, body_text)
  VALUES ('delete', old.rowid, old.title, old.summary, old.slug, old.type, old.subtype, old.tags_text, old.body_text);
  INSERT INTO content_search_fts(rowid, title, summary, slug, type, subtype, tags_text, body_text)
  VALUES (new.rowid, new.title, new.summary, new.slug, new.type, new.subtype, new.tags_text, new.body_text);
END;
