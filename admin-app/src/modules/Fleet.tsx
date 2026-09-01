import { useEffect, useMemo, useState } from "react";
import {
  getFleetVehicle,
  getFleetVehicles,
  updateFleetVehicle,
  type FleetVehicle,
  type FleetVehicleUpdate,
  type VehicleAvailabilityStatus,
  type VehicleClass,
  type VehicleVerificationStatus,
} from "../api/fleet";

function statusClass(value: string | null | undefined) {
  return String(value ?? "UNKNOWN")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function formatCoordinate(
  value: number | string | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return Number(value).toFixed(6);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const vehicleClasses: VehicleClass[] = [
  "MOTORCYCLE",
  "MINI_VAN",
  "CARGO_VAN",
  "PICKUP",
  "LIGHT_TRUCK",
  "MEDIUM_TRUCK",
  "HEAVY_TRUCK",
  "CONTAINER",
  "FLATBED",
  "REFRIGERATED_TRUCK",
];

const availabilityStatuses: VehicleAvailabilityStatus[] = [
  "AVAILABLE",
  "UNAVAILABLE",
  "ON_TRIP",
];

const verificationStatuses: VehicleVerificationStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
];

function labelize(value: string | null | undefined) {
  return String(value ?? "UNKNOWN")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Fleet() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] =
    useState<FleetVehicle | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [form, setForm] = useState<FleetVehicleUpdate>({});

  async function loadVehicles() {
    try {
      setLoading(true);
      setError("");

      const result = await getFleetVehicles();
      setVehicles(result);
    } catch {
      setError("Unable to load fleet vehicles.");
    } finally {
      setLoading(false);
    }
  }

  async function openVehicle(id: string) {
    setSelectedId(id);
    setSelectedVehicle(null);
    setDetailLoading(true);
    setError("");

    try {
      const vehicle = await getFleetVehicle(id);

      setSelectedVehicle(vehicle);
      setForm({
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        vehicleClass: vehicle.vehicleClass,
        make: vehicle.make ?? undefined,
        model: vehicle.model ?? undefined,
        year: vehicle.year ?? undefined,
        color: vehicle.color ?? undefined,
        capacity: vehicle.capacity ?? undefined,
        availabilityStatus: vehicle.availabilityStatus,
        verificationStatus: vehicle.verificationStatus,
      });
    } catch (error) {
      console.error("[TransConet Admin] Unable to load fleet vehicle:", error);
      setSelectedVehicle(null);
      setError("Unable to load vehicle information. Please try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  function updateForm<K extends keyof FleetVehicleUpdate>(
    key: K,
    value: FleetVehicleUpdate[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveVehicle() {
    if (!selectedVehicle) return;

    try {
      setSaving(true);
      setError("");

      const updated = await updateFleetVehicle(
        selectedVehicle.id,
        form,
      );

      setSelectedVehicle(updated);

      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === updated.id
            ? {
                ...vehicle,
                ...updated,
              }
            : vehicle,
        ),
      );
    } catch {
      setError("Unable to update vehicle.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // Intentional: this effect synchronizes component state with the backend API.
    void loadVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return vehicles;
    }

    return vehicles.filter((vehicle) => {
      const transporter = vehicle.transporter;

      return [
        vehicle.registrationNumber,
        vehicle.vehicleType,
        vehicle.vehicleClass,
        vehicle.make,
        vehicle.model,
        vehicle.availabilityStatus,
        vehicle.verificationStatus,
        transporter?.firstName,
        transporter?.lastName,
        transporter?.email,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        );
    });
  }, [vehicles, search]);

  const availableCount = vehicles.filter(
    (vehicle) => vehicle.availabilityStatus === "AVAILABLE",
  ).length;

  const onTripCount = vehicles.filter(
    (vehicle) => vehicle.availabilityStatus === "ON_TRIP",
  ).length;

  const pendingCount = vehicles.filter(
    (vehicle) => vehicle.verificationStatus === "PENDING",
  ).length;

  if (selectedId) {
    if (detailLoading || !selectedVehicle) {
      return (
        <section className="dashboard">
          <div className="module-header">
            <div>
              <button
                type="button"
                className="customer-back-button"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedVehicle(null);
                  setDetailLoading(false);
                  setError("");
                }}
              >
                ← Fleet Directory
              </button>

              <div className="module-kicker">
                OPERATIONS / FLEET MANAGEMENT
              </div>

              <h2>Vehicle</h2>

              <p>
                Loading the selected vehicle administration record.
              </p>
            </div>
          </div>

          {error ? (
            <div className="panel customer-state error-state">
              {error}
            </div>
          ) : (
            <div className="panel customer-state">
              Loading vehicle…
            </div>
          )}
        </section>
      );
    }

    const transporter = selectedVehicle.transporter;

    return (
      <section className="dashboard">
        <div className="module-header">
          <div>
            <button
              type="button"
              className="customer-back-button"
              onClick={() => {
                setSelectedId(null);
                setSelectedVehicle(null);
                setError("");
              }}
            >
              ← Fleet Directory
            </button>

            <div className="module-kicker">
              OPERATIONS / FLEET MANAGEMENT
            </div>

            <h2>{selectedVehicle.registrationNumber}</h2>

            <p>
              {selectedVehicle.make || selectedVehicle.vehicleType}{" "}
              {selectedVehicle.model || ""}
            </p>
          </div>

          <span
            className={`status-pill ${statusClass(
              selectedVehicle.verificationStatus,
            )}`}
          >
            {labelize(selectedVehicle.verificationStatus)}
          </span>
        </div>

        {error && (
          <div className="panel customer-state error-state">
            {error}
          </div>
        )}

        {detailLoading ? (
          <div className="panel customer-state">
            Loading vehicle…
          </div>
        ) : (
          <div className="customer-layout">
            <aside className="customer-subnav panel">
              <div className="customer-identity">
                <div className="customer-avatar">
                  {selectedVehicle.registrationNumber
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <strong>
                  {selectedVehicle.registrationNumber}
                </strong>

                <span>
                  {selectedVehicle.vehicleType}
                </span>

                <span>
                  {labelize(selectedVehicle.vehicleClass)}
                </span>
              </div>

              <div className="customer-actions">
                <strong>Operational Status</strong>

                <span
                  className={`status-pill ${statusClass(
                    selectedVehicle.availabilityStatus,
                  )}`}
                >
                  {labelize(selectedVehicle.availabilityStatus)}
                </span>
              </div>
            </aside>

            <div className="customer-content">
              <div className="section-title">
                <h3>Vehicle Details</h3>
                <span>
                  Fleet identity, specifications and operational state
                </span>
              </div>

              <div className="panel customer-detail-panel">
                <div className="detail-grid">
                  <div>
                    <span>Registration</span>
                    <strong>
                      {selectedVehicle.registrationNumber}
                    </strong>
                  </div>

                  <div>
                    <span>Vehicle Type</span>
                    <strong>
                      {selectedVehicle.vehicleType}
                    </strong>
                  </div>

                  <div>
                    <span>Vehicle Class</span>
                    <strong>
                      {labelize(selectedVehicle.vehicleClass)}
                    </strong>
                  </div>

                  <div>
                    <span>Make</span>
                    <strong>
                      {selectedVehicle.make || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Model</span>
                    <strong>
                      {selectedVehicle.model || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Year</span>
                    <strong>
                      {selectedVehicle.year ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Color</span>
                    <strong>
                      {selectedVehicle.color || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Capacity</span>
                    <strong>
                      {selectedVehicle.capacity ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Availability</span>
                    <strong>
                      {labelize(
                        selectedVehicle.availabilityStatus,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Verification</span>
                    <strong>
                      {labelize(
                        selectedVehicle.verificationStatus,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Latitude</span>
                    <strong>
                      {formatCoordinate(
                        selectedVehicle.currentLatitude,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Longitude</span>
                    <strong>
                      {formatCoordinate(
                        selectedVehicle.currentLongitude,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Created</span>
                    <strong>
                      {formatDate(selectedVehicle.createdAt)}
                    </strong>
                  </div>

                  <div>
                    <span>Updated</span>
                    <strong>
                      {formatDate(selectedVehicle.updatedAt)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="section-title" style={{ marginTop: 22 }}>
                <h3>Transporter</h3>
                <span>
                  Current vehicle ownership relationship
                </span>
              </div>

              <div className="panel customer-detail-panel">
                <div className="detail-grid">
                  <div>
                    <span>Name</span>
                    <strong>
                      {transporter
                        ? `${transporter.firstName} ${transporter.lastName}`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {transporter?.email || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>
                      {transporter?.phone || "—"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="section-title" style={{ marginTop: 22 }}>
                <h3>Edit Vehicle</h3>
                <span>
                  Changes are validated by the Fleet administration API
                </span>
              </div>

              <div className="panel" style={{ padding: 20 }}>
                <div className="detail-grid">
                  <div>
                    <span>Registration Number</span>
                    <input
                      value={form.registrationNumber ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "registrationNumber",
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div>
                    <span>Vehicle Type</span>
                    <input
                      value={form.vehicleType ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "vehicleType",
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div>
                    <span>Vehicle Class</span>
                    <select
                      value={form.vehicleClass ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "vehicleClass",
                          event.target.value as VehicleClass,
                        )
                      }
                    >
                      {vehicleClasses.map((value) => (
                        <option key={value} value={value}>
                          {labelize(value)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span>Make</span>
                    <input
                      value={form.make ?? ""}
                      onChange={(event) =>
                        updateForm("make", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <span>Model</span>
                    <input
                      value={form.model ?? ""}
                      onChange={(event) =>
                        updateForm("model", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <span>Year</span>
                    <input
                      type="number"
                      value={form.year ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "year",
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        )
                      }
                    />
                  </div>

                  <div>
                    <span>Color</span>
                    <input
                      value={form.color ?? ""}
                      onChange={(event) =>
                        updateForm("color", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <span>Capacity</span>
                    <input
                      type="number"
                      min="0"
                      value={form.capacity ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "capacity",
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        )
                      }
                    />
                  </div>

                  <div>
                    <span>Availability Status</span>
                    <select
                      value={form.availabilityStatus ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "availabilityStatus",
                          event.target
                            .value as VehicleAvailabilityStatus,
                        )
                      }
                    >
                      {availabilityStatuses.map((value) => (
                        <option key={value} value={value}>
                          {labelize(value)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span>Verification Status</span>
                    <select
                      value={form.verificationStatus ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "verificationStatus",
                          event.target
                            .value as VehicleVerificationStatus,
                        )
                      }
                    >
                      {verificationStatuses.map((value) => (
                        <option key={value} value={value}>
                          {labelize(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="text-button"
                    disabled={saving}
                    onClick={() => void saveVehicle()}
                  >
                    {saving ? "Saving…" : "Save Vehicle"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            OPERATIONS / FLEET MANAGEMENT
          </div>

          <h2>Fleet</h2>

          <p>
            Monitor registered vehicles, operational availability and
            verification state.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => void loadVehicles()}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <div className="stats-grid customer-stats">
        <div className="stat-card">
          <span>Total Vehicles</span>
          <strong>{vehicles.length}</strong>
          <small>Registered fleet</small>
        </div>

        <div className="stat-card">
          <span>Available</span>
          <strong>{availableCount}</strong>
          <small>Ready for operations</small>
        </div>

        <div className="stat-card">
          <span>On Trip</span>
          <strong>{onTripCount}</strong>
          <small>Currently assigned</small>
        </div>

        <div className="stat-card">
          <span>Pending Verification</span>
          <strong>{pendingCount}</strong>
          <small>Awaiting approval</small>
        </div>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-header">
          <div>
            <h2>Fleet Directory</h2>
            <p>
              Select a vehicle to inspect or update its administration
              record.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            placeholder="Search registration, type, class or transporter…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              width: "100%",
              maxWidth: 480,
              padding: "10px 12px",
              border: "1px solid #e3e7ee",
              borderRadius: 8,
            }}
          />
        </div>

        {loading ? (
          <div className="customer-state">
            Loading fleet…
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="customer-empty">
            <strong>No vehicles found</strong>
            <span>
              No fleet records match the current search.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Class</th>
                  <th>Transporter</th>
                  <th>Availability</th>
                  <th>Verification</th>
                  <th>Location</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <strong>
                        {vehicle.registrationNumber}
                      </strong>

                      <span className="table-secondary">
                        {vehicle.make || vehicle.vehicleType}{" "}
                        {vehicle.model || ""}
                      </span>
                    </td>

                    <td>
                      {labelize(vehicle.vehicleClass)}
                    </td>

                    <td>
                      {vehicle.transporter
                        ? `${vehicle.transporter.firstName} ${vehicle.transporter.lastName}`
                        : "—"}
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          vehicle.availabilityStatus,
                        )}`}
                      >
                        {labelize(vehicle.availabilityStatus)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          vehicle.verificationStatus,
                        )}`}
                      >
                        {labelize(vehicle.verificationStatus)}
                      </span>
                    </td>

                    <td>
                      {formatCoordinate(
                        vehicle.currentLatitude,
                      )}
                      ,{" "}
                      {formatCoordinate(
                        vehicle.currentLongitude,
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          void openVehicle(vehicle.id)
                        }
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
