CREATE TABLE IF NOT EXISTS evidence_import_lock (
  id TINYINT PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT IGNORE INTO evidence_import_lock(id) VALUES (1);
CREATE TABLE IF NOT EXISTS evidence_regions (
  code VARCHAR(64) COLLATE utf8mb4_bin PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  parent_code VARCHAR(64) COLLATE utf8mb4_bin NULL,
  dataset ENUM('official','demo') NOT NULL,
  FOREIGN KEY (parent_code) REFERENCES evidence_regions(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS evidence_batches (
  id CHAR(36) PRIMARY KEY,
  actor VARCHAR(200) NOT NULL,
  reason TEXT NOT NULL,
  imported_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS evidence_heads (
  kind ENUM('document','clause') NOT NULL,
  id VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  version INT UNSIGNED NOT NULL,
  checksum CHAR(64) NOT NULL,
  PRIMARY KEY(kind,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS evidence_versions (
  kind ENUM('document','clause') NOT NULL,
  id VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  version INT UNSIGNED NOT NULL,
  checksum CHAR(64) NOT NULL,
  payload JSON NOT NULL,
  operation ENUM('create','update') NOT NULL,
  batch_id CHAR(36) NOT NULL,
  PRIMARY KEY(kind,id,version),
  FOREIGN KEY(batch_id) REFERENCES evidence_batches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
