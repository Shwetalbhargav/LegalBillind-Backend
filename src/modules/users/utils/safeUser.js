function normalizeId(value) {
  if (!value) return null;
  if (value._id && value._id !== value) return normalizeId(value._id);
  return typeof value.toString === 'function' ? value.toString() : value;
}

export function toSafeUser(user) {
  if (!user) return null;
  const obj = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    id: normalizeId(obj._id ?? obj.id),
    name: obj.name ?? null,
    email: obj.email ?? null,
    mobile: obj.mobile ?? null,
    role: obj.role ?? null,
    firmId: normalizeId(obj.firmId),
    photoUrl: obj.photoUrl ?? '/images/default-user.jpg',
    address: obj.address ?? null,
    qualifications: Array.isArray(obj.qualifications) ? obj.qualifications : [],
    createdAt: obj.createdAt ?? null,
    updatedAt: obj.updatedAt ?? null,
  };
}
