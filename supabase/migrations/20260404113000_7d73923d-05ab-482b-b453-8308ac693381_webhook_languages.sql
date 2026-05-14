-- Set the n8n webhook URL for language generation
INSERT INTO public.app_settings (key, value, updated_at)
VALUES (
  'webhook_languages',
  'https://czacki3.app.n8n.cloud/webhook-test/7d73923d-05ab-482b-b453-8308ac693381',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
