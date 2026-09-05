type DecimalLike = {
  toString(): string;
};

function decimal(
  value: DecimalLike | number | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function toTransporterDto(transporter: any) {
  return {
    userId: transporter.userId,

    companyName: transporter.companyName,
    transporterType: transporter.transporterType,
    businessRegistrationNumber: transporter.businessRegistrationNumber,

    address: transporter.address,
    city: transporter.city,
    state: transporter.state,
    country: transporter.country,

    verificationStatus: transporter.verificationStatus,
    tier2Approved: transporter.tier2Approved,

    rating: transporter.rating,
    totalTrips: transporter.totalTrips,

    totalEarnings: decimal(transporter.totalEarnings),
  };
}
