-- Backup manual
pg_dump -U postgres pos_calletano_restaurante > backup.sql

-- Restaurar backup
psql -U postgres pos_calletano_restaurante < backup.sql