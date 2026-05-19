-- ============================================================================
--  eGuardian AI Concierge — Datos semilla (demo)
--  Ejecutar DESPUÉS de schema.sql
-- ============================================================================

-- Roles & permisos -----------------------------------------------------------
INSERT INTO roles (slug, name) VALUES
 ('super_admin','Super Administrador'),
 ('admin','Administrador Condominio'),
 ('operator','Operador Teleasistencia'),
 ('viewer','Solo Lectura');

INSERT INTO permissions (slug,name) VALUES
 ('residents.manage','Gestionar residentes'),
 ('visits.manage','Gestionar visitas'),
 ('conversations.read','Ver conversaciones'),
 ('incidents.manage','Gestionar incidentes'),
 ('operators.manage','Gestionar operadores'),
 ('dashboard.view','Ver dashboard');

INSERT INTO role_permission
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug IN ('super_admin','admin');
INSERT INTO role_permission
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.slug IN ('conversations.read','incidents.manage','dashboard.view')
WHERE r.slug = 'operator';

-- Condominio -----------------------------------------------------------------
INSERT INTO condominiums (id,name,address,timezone) VALUES
 ('11111111-1111-1111-1111-111111111111',
  'Edificio Costanera Center',
  'Av. Andrés Bello 2425, Providencia, Santiago',
  'America/Santiago');

-- Usuarios -------------------------------------------------------------------
-- password_hash de ejemplo = bcrypt('Demo1234!')
INSERT INTO users (id,condominium_id,role_id,name,email,password_hash,phone) VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
  (SELECT id FROM roles WHERE slug='admin'),'Admin Demo','admin@eguardian.cl',
  '$2y$10$Q9wXp1nQ7vN2yQk3m6sJ3uVbq6T0o9o9o9o9o9o9o9o9o9o9o9o','+56 2 2345 6789'),
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
  (SELECT id FROM roles WHERE slug='operator'),'Daniela Reyes','daniela@eguardian.cl',
  '$2y$10$Q9wXp1nQ7vN2yQk3m6sJ3uVbq6T0o9o9o9o9o9o9o9o9o9o9o9o','+56 9 5544 3322'),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
  (SELECT id FROM roles WHERE slug='operator'),'Felipe Cárdenas','felipe@eguardian.cl',
  '$2y$10$Q9wXp1nQ7vN2yQk3m6sJ3uVbq6T0o9o9o9o9o9o9o9o9o9o9o9o','+56 9 1122 3344');

-- Departamentos --------------------------------------------------------------
INSERT INTO apartments (id,condominium_id,code,tower,floor) VALUES
 ('33333333-0000-0000-0000-000000000302','11111111-1111-1111-1111-111111111111','302','A',3),
 ('33333333-0000-0000-0000-000000001204','11111111-1111-1111-1111-111111111111','1204','A',12),
 ('33333333-0000-0000-0000-000000000705','11111111-1111-1111-1111-111111111111','705','B',7),
 ('33333333-0000-0000-0000-000000000108','11111111-1111-1111-1111-111111111111','108','B',1);

-- Residentes -----------------------------------------------------------------
INSERT INTO residents (condominium_id,apartment_id,full_name,email,phone,auto_approve,status) VALUES
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000302','Juan Pérez','j.perez@mail.com','+56 9 7654 3210',false,'active'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000001204','María González','m.gonzalez@mail.com','+56 9 8123 4567',true,'active'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000705','Carlos Soto','c.soto@mail.com','+56 9 6011 2233',false,'active'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000108','Valentina Rivas','v.rivas@mail.com','+56 9 9988 7766',false,'suspended');

-- Dispositivo (tótem) --------------------------------------------------------
INSERT INTO devices (id,condominium_id,name,serial,location,status,last_seen_at) VALUES
 ('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
  'Tótem Lobby','EG-TT-0001','Hall de acceso principal','online',now());

-- Operadores -----------------------------------------------------------------
INSERT INTO operators (user_id,condominium_id,status,shift_start,shift_end) VALUES
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','available','08:00','16:00'),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','busy','08:00','16:00');

-- Conversación + mensajes de ejemplo ----------------------------------------
INSERT INTO conversations (id,condominium_id,device_id,detected_intent,status,summary) VALUES
 ('55555555-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
  '44444444-0000-0000-0000-000000000001','visit','closed_ai',
  'Visita autorizada para depto 302');

INSERT INTO conversation_messages (conversation_id,sender,content,intent,confidence) VALUES
 ('55555555-0000-0000-0000-000000000001','ai','Buenas tardes, ¿en qué puedo ayudarle?',NULL,NULL),
 ('55555555-0000-0000-0000-000000000001','visitor','Vengo a ver a Juan Pérez del 302','visit',0.962),
 ('55555555-0000-0000-0000-000000000001','ai','Contacto a Juan Pérez, un momento…',NULL,NULL),
 ('55555555-0000-0000-0000-000000000001','system','Residente autorizó el ingreso',NULL,NULL),
 ('55555555-0000-0000-0000-000000000001','ai','Autorizado. Diríjase al ascensor principal, piso 3.',NULL,NULL);

-- Incidente abierto ----------------------------------------------------------
INSERT INTO incidents (condominium_id,reason,priority,status) VALUES
 ('11111111-1111-1111-1111-111111111111',
  'Emergencia declarada por visitante en Tótem Lobby','critical','open');
