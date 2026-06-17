
UPDATE posts SET content = regexp_replace(content, '(^|[^/\w.])build\.londonra\.com', '\1https://build.londonra.com', 'gi')
WHERE status='draft' AND content ~* '(^|[^/\w.])build\.londonra\.com';

UPDATE posts SET first_comment_text = regexp_replace(first_comment_text, '(^|[^/\w.])build\.londonra\.com', '\1https://build.londonra.com', 'gi')
WHERE status='draft' AND first_comment_text ~* '(^|[^/\w.])build\.londonra\.com';

UPDATE posts SET content = replace(content, 'https://https://', 'https://') WHERE content LIKE '%https://https://%';
UPDATE posts SET first_comment_text = replace(first_comment_text, 'https://https://', 'https://') WHERE first_comment_text LIKE '%https://https://%';

UPDATE posts SET first_comment_text = 'If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: https://build.londonra.com'
WHERE status='draft'
  AND content NOT LIKE '%https://build.londonra.com%'
  AND coalesce(first_comment_text,'') NOT LIKE '%https://build.londonra.com%';
