export type CustomerProfileDto = {
  userId: string;
  city: string | null;
  state: string | null;
  country: string | null;
  verificationStatus: string;
  rating: number;
  totalBookings: number;
};

export type TransporterProfileDto = {
  userId: string;
  companyName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  verificationStatus: string;
  tier2Approved: boolean;
  rating: number;
  totalTrips: number;
};

export type UserDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  profilePhoto: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  customerProfile: CustomerProfileDto | null;
  transporterProfile: TransporterProfileDto | null;
};

function toCustomerProfileDto(
  profile: CustomerProfileDto,
): CustomerProfileDto {
  return {
    userId: profile.userId,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    verificationStatus: profile.verificationStatus,
    rating: profile.rating,
    totalBookings: profile.totalBookings,
  };
}

function toTransporterProfileDto(
  profile: TransporterProfileDto,
): TransporterProfileDto {
  return {
    userId: profile.userId,
    companyName: profile.companyName,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    verificationStatus: profile.verificationStatus,
    tier2Approved: profile.tier2Approved,
    rating: profile.rating,
    totalTrips: profile.totalTrips,
  };
}

export function toUserDto(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  profilePhoto: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  customerProfile: CustomerProfileDto | null;
  transporterProfile: TransporterProfileDto | null;
}): UserDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    profilePhoto: user.profilePhoto,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    customerProfile: user.customerProfile
      ? toCustomerProfileDto(user.customerProfile)
      : null,
    transporterProfile: user.transporterProfile
      ? toTransporterProfileDto(user.transporterProfile)
      : null,
  };
}
