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

function date(
  value: Date | null | undefined,
): string | null {
  return value ? value.toISOString() : null;
}

export function toVehicleDto(vehicle: any) {
  return {
    id: vehicle.id,
    transporterId: vehicle.transporterId,

    registrationNumber: vehicle.registrationNumber,
    vehicleType: vehicle.vehicleType,
    vehicleClass: vehicle.vehicleClass,

    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    capacity: vehicle.capacity,

    verificationStatus: vehicle.verificationStatus,
    availabilityStatus: vehicle.availabilityStatus,

    currentLatitude: decimal(vehicle.currentLatitude),
    currentLongitude: decimal(vehicle.currentLongitude),

    createdAt: date(vehicle.createdAt),
    updatedAt: date(vehicle.updatedAt),
  };
}
