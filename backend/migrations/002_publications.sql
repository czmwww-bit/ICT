CREATE TABLE IF NOT EXISTS evidence_publications (
  sequence_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('document','clause') NOT NULL,
  id VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  version INT UNSIGNED NOT NULL,
  decision ENUM('approved','rejected') NOT NULL,
  actor VARCHAR(200) NOT NULL,
  reason TEXT NOT NULL,
  reviewed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY(kind,id,version) REFERENCES evidence_versions(kind,id,version),
  INDEX publication_record(kind,id,version,sequence_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
