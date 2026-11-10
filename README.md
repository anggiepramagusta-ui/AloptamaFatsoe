# 🛰️ Weather Server IRM

> A server application for the IRM Team's weather data (AWOS/AWS) monitoring and management dashboard.

This application functions as the *backend* for a web interface that serves *real-time* and historical data from weather stations. It connects to a time-series database (InfluxDB) for sensor data and a relational database (PostgreSQL) for station metadata and user management.

## ✨ Key Features

* **Map Dashboard:** Displays real-time location and status of weather stations.
* **Analytics & Tables:** Presents historical data in table and graph formats.
* **Authentication:** A secure, session-based login system for users.
* **Admin Management:** A dedicated admin page for managing users and stations.
* **Structured API:** Provides endpoints to retrieve weather data, status, and metadata.

## 🚀 Tech Stack

This application is built and deployed using a modern tech stack:

* **Backend:** Node.js (with Express.js)
* **Database (Metadata):** PostgreSQL
* **Database (Time-Series):** InfluxDB v2
* **Containerization:** Docker & Docker Compose
* **Deployment (CI/CD):** [Coolify](https://coolify.io/)
* **Source Control:** [GitHub](https://github.com)

## 📦 Deployment Workflow (CI/CD)

This repository is connected to **Coolify** for *Continuous Integration & Continuous Deployment* (CI/CD).

1.  **Single Source of Truth:** This GitHub repository (`irmsub/weather-server-irm`) is the single source of truth for the application code.
2.  **Trigger:** Every new `git push` or *commit* to the `main` branch will automatically send a *webhook* (signal) to the Coolify server.
3.  **Automated Process:** Coolify will:
    * Pull the latest code from the `main` branch.
    * Read the `docker-compose.yml` in the repository root.
    * Build a new Docker *image* based on the `Dockerfile`.
    * Stop the old `app` container.
    * Run the new `app` container with the latest *image*, connecting it to the existing networks.

**IMPORTANT:** Manually editing code on the server is strictly forbidden. All changes **MUST** be made via `git push` to this repository.

## 🔧 Configuration & Environment Variables

The `docker-compose.yml` file in this repository is intentionally "clean" of all secrets. All secret variables and host-specific configurations **MUST** be injected via the **Environment Variables** UI in Coolify.

This application requires the following variables to run:

| Variable | Example Value | Required (in UI)? | Description |
| :--- | :--- | :--- | :--- |
| `POSTGRES_HOST` | `postgresqi-database-weather-irm` | **Yes** | The service name (DNS) of the Coolify-deployed Postgres database. |
| `POSTGRES_USER` | `bmkg` | **Yes** | Username for the Postgres database. |
| `POSTGRES_PASSWORD`| `**********` | **Yes (Secret)** | Password for the Postgres database. Must be marked "Is Secret?" in the UI. |
| `POSTGRES_DB` | `irmdb` | **Yes** | Name of the database inside Postgres. |
| `POSTGRES_PORT` | `5432` | No (Automatic) | Internal Postgres port. |
| `INFLUX_URL` | `http://influxdb:8086` | **Yes** | Internal address of InfluxDB on the `monitoring-net` network. |
| `INFLUX_TOKEN` | `**********` | **Yes (Secret)** | All-Access token for InfluxDB. Must be marked "Is Secret?" in the UI. |
| `INFLUX_ORG` | `IRM` | **Yes** | Organization name in InfluxDB. |
| `INFLUX_BUCKET` | `awos_monitoring` | **Yes** | Data Bucket name in InfluxDB. |
| `SESSION_SECRET` | `**********` | **Yes (Secret)** | Random secret key to secure login sessions. Must be marked "Is Secret?" in the UI. |

### Network Configuration

This `app` is designed to connect to **TWO** Docker networks simultaneously (defined in `docker-compose.yml`):

1.  **`default` (Internal Coolify):** To connect to the `postgresqi-database-weather-irm` database.
2.  **`monitoring-net` (External):** To connect to legacy services like `influxdb` and `grafana`.

## © Copyright

Created and managed by **Tim IRM** &copy; 2025
