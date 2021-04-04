export const getOrganizationActivationStatus = async (DB) => {
  const data = await DB('organizations as o')
    .select('o.id as id', 'u.name as name', 'o.is_activated as isActivated')
    .join('users as u', 'u.id', 'o.user_id')
    .where('o.is_activated', false);
  return data;
};

export default {
  getOrganizationActivationStatus,
};
