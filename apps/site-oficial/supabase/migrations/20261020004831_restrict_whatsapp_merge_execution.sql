REVOKE EXECUTE ON FUNCTION public.merge_whatsapp_contacts(uuid,uuid,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_whatsapp_contacts(uuid,uuid,uuid[]) TO service_role;
