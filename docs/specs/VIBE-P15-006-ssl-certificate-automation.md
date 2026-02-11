# VIBE-P15-006: SSL Certificate Automation

**Phase**: 15 - Production Deployment & Operations
**Priority**: P1
**Estimated Effort**: High (6-8 hours)
**Dependencies**: PHASE7-TASK-01 (Docker Containerization), PHASE7-TASK-02 (Health Checks)
**Created**: February 9, 2026
**Status**: Specification Complete

---

## Overview

This specification defines an automated SSL/TLS certificate management system for the Parent Harness platform, enabling secure HTTPS deployment with zero-downtime certificate provisioning, automatic renewal, and support for custom domains. The system leverages Let's Encrypt via the ACME protocol to provide free, automated SSL certificates with wildcard support.

### Context

The Parent Harness platform requires secure HTTPS connections for:

1. **Dashboard Access** - Web UI at `dashboard.vibe.ai` or custom domains
2. **API Endpoints** - WebSocket and REST API at `api.vibe.ai`
3. **Webhook Receivers** - Telegram, GitHub, external integrations
4. **Multi-tenant Deployments** - Custom domains per customer (e.g., `customer.vibe.ai`)

Manual certificate management is error-prone, time-consuming, and risks service downtime if certificates expire. Automated SSL management ensures:

- **Security**: Always-valid certificates prevent browser warnings
- **Reliability**: Auto-renewal prevents expiration-related outages
- **Scalability**: Support for wildcard and multi-domain certificates
- **Developer Experience**: One-command SSL provisioning for new deployments

### Current State

**Existing Infrastructure**:

- ✅ Docker Compose orchestration (`parent-harness/docker-compose.yml`)
- ✅ Nginx-ready configuration (port 3333 for orchestrator, 3334 for dashboard)
- ✅ Health check endpoints (`/health`)
- ✅ Environment variable configuration system

**Missing Components** (this task):

- ❌ SSLManager class for certificate lifecycle management
- ❌ ACME protocol integration for Let's Encrypt
- ❌ Certificate storage and retrieval system
- ❌ Auto-renewal scheduling and monitoring
- ❌ Nginx/Traefik SSL configuration generation
- ❌ Wildcard certificate support
- ❌ Certificate health checks and alerting

---

## Requirements

### Functional Requirements

**FR-1: SSLManager Class**

- Centralized certificate lifecycle management
- Methods: `provision()`, `renew()`, `revoke()`, `getCertificate()`, `listCertificates()`
- Support for single domain, multi-domain (SAN), and wildcard certificates
- Certificate status tracking: `pending`, `issued`, `expiring_soon`, `expired`, `revoked`
- Database persistence for certificate metadata (not private keys)
- Integration with secrets management for private key storage

**FR-2: ACME Protocol Integration**

- Let's Encrypt integration via `acme-client` npm package
- Support HTTP-01 challenge (port 80 challenge response)
- Support DNS-01 challenge (for wildcard certificates)
- Automatic challenge response handling
- Account registration and key management
- Rate limit awareness (5 certificates per domain per week)

**FR-3: Certificate Provisioning**

- Command-line tool: `npm run ssl:provision -- --domain example.com`
- API endpoint: `POST /api/ssl/provision { domain, type, challenge }`
- Support provisioning during Docker deployment
- Generate CSR (Certificate Signing Request) with domain names
- Complete ACME challenge workflow
- Store certificate, private key, and chain
- Validate certificate after issuance
- Emit WebSocket event: `ssl:provisioned`

**FR-4: Auto-Renewal Scheduling**

- Cron-based renewal check (daily at 2 AM)
- Renew certificates expiring within 30 days
- Retry failed renewals with exponential backoff
- Email/Telegram notifications for renewal success/failure
- Graceful service reload after renewal (zero downtime)
- Health check integration (flag expiring certificates)
- Emit WebSocket event: `ssl:renewed`

**FR-5: Certificate Storage and Retrieval**

- Store certificates in `/app/data/ssl/certs/{domain}/` directory structure
- Private keys stored separately in `/app/data/ssl/private/{domain}/`
- File permissions: `0600` for private keys, `0644` for certificates
- Database table: `ssl_certificates` (metadata only, no keys)
- Support certificate export for manual deployment
- Backup mechanism for certificate files
- Environment variable override: `SSL_STORAGE_PATH`

**FR-6: Wildcard Certificate Support**

- DNS-01 challenge required for `*.example.com`
- Integration with DNS providers (Cloudflare, Route53, DigitalOcean)
- DNS provider API key configuration via environment variables
- Automatic DNS record creation and cleanup
- Support for multiple subdomains with single wildcard cert

**FR-7: Platform-Specific Configuration**

- **Nginx**: Generate `nginx-ssl.conf` with certificate paths
- **Traefik**: Generate `traefik-ssl.yml` with certificate resolvers
- **Docker**: Volume mount certificates into containers
- **Cloud Load Balancers**: Export certificates for AWS ALB, GCP Load Balancer
- Configuration templates in `parent-harness/ssl/templates/`
- Auto-apply configuration after certificate provisioning

### Non-Functional Requirements

**NFR-1: Security**

- Private keys never logged or transmitted
- Private keys encrypted at rest (optional: gpg encryption)
- Certificate files accessible only by orchestrator service
- ACME account keys stored securely
- No hardcoded credentials in code
- Support for Hardware Security Modules (HSM) in future

**NFR-2: Reliability**

- Certificate renewal attempts 3 times before alerting
- Graceful degradation if ACME service unavailable
- Fallback to self-signed certificates for development
- Database transaction safety for certificate records
- Idempotent provisioning (re-running is safe)
- Zero-downtime certificate rotation

**NFR-3: Performance**

- Certificate provisioning completes in <5 minutes
- Renewal cron completes in <10 minutes for 10 domains
- No performance impact on main orchestrator loop
- Async certificate operations (non-blocking)
- Certificate cache to avoid repeated file reads

**NFR-4: Observability**

- All SSL operations logged with timestamps
- Certificate expiry dates tracked in database
- Dashboard widget showing certificate status
- Prometheus metrics: `ssl_cert_expiry_days`, `ssl_renewal_success_total`
- Alert rules: certificate expiring in <7 days, renewal failure
- Health endpoint includes SSL status: `GET /health?ssl=true`

**NFR-5: Developer Experience**

- One-command provisioning: `npm run ssl:provision`
- Clear error messages for ACME failures
- Development mode uses self-signed certificates
- Documentation with examples for common scenarios
- TypeScript types for all SSL operations

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SSL Certificate System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SSLManager                             │  │
│  │                                                            │  │
│  │  + provision(domain, type, challenge)                     │  │
│  │  + renew(domain)                                           │  │
│  │  + revoke(domain, reason)                                  │  │
│  │  + getCertificate(domain)                                  │  │
│  │  + listCertificates(filters)                               │  │
│  │  + checkExpiry()                                           │  │
│  └───────────┬──────────────────────────┬────────────────────┘  │
│              │                          │                        │
│   ┌──────────▼────────┐      ┌─────────▼─────────┐             │
│   │   ACME Client     │      │  Certificate      │             │
│   │                   │      │  Storage          │             │
│   │  - HTTP-01        │      │                   │             │
│   │  - DNS-01         │      │  /data/ssl/certs/ │             │
│   │  - Account mgmt   │      │  /data/ssl/private│             │
│   │  - Challenge      │      │  Database records │             │
│   └──────────┬────────┘      └─────────┬─────────┘             │
│              │                          │                        │
│   ┌──────────▼──────────────────────────▼─────────┐             │
│   │           Let's Encrypt ACME API               │             │
│   │       (acme-v02.api.letsencrypt.org)          │             │
│   └────────────────────────────────────────────────┘             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Configuration Generators                     │  │
│  │                                                            │  │
│  │  - NginxSSLConfig (nginx-ssl.conf)                       │  │
│  │  - TraefikSSLConfig (traefik-ssl.yml)                    │  │
│  │  - DockerComposeSSL (volume mounts)                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Renewal Scheduler (Cron)                     │  │
│  │                                                            │  │
│  │  - Daily check at 2 AM                                    │  │
│  │  - Renew certs expiring in <30 days                      │  │
│  │  - Retry logic with backoff                              │  │
│  │  - Notifications (Telegram, email)                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

**Table: `ssl_certificates`**

```sql
CREATE TABLE ssl_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('single', 'wildcard', 'multi')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'issued', 'expiring_soon', 'expired', 'revoked')),
  challenge_type TEXT NOT NULL CHECK(challenge_type IN ('http-01', 'dns-01')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_renewed_at TEXT,
  renewal_attempts INTEGER DEFAULT 0,
  subject_alternative_names TEXT, -- JSON array of domains
  cert_path TEXT NOT NULL,
  private_key_path TEXT NOT NULL,
  chain_path TEXT NOT NULL,
  acme_account_id TEXT,
  metadata TEXT, -- JSON for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ssl_certs_domain ON ssl_certificates(domain);
CREATE INDEX idx_ssl_certs_status ON ssl_certificates(status);
CREATE INDEX idx_ssl_certs_expires ON ssl_certificates(expires_at);
```

### Component Details

#### 1. SSLManager Class

**File**: `parent-harness/orchestrator/src/ssl/manager.ts`

```typescript
import { ACME } from "./acme-client.js";
import { CertificateStorage } from "./storage.js";
import { db } from "../db/index.js";
import { events } from "../db/events.js";

export interface CertificateOptions {
  domain: string;
  type: "single" | "wildcard" | "multi";
  challengeType: "http-01" | "dns-01";
  altNames?: string[]; // For multi-domain certificates
  dnsProvider?: "cloudflare" | "route53" | "digitalocean";
}

export interface Certificate {
  id: number;
  domain: string;
  type: string;
  status: string;
  issuedAt: Date;
  expiresAt: Date;
  daysUntilExpiry: number;
  certPath: string;
  privateKeyPath: string;
}

export class SSLManager {
  private acme: ACME;
  private storage: CertificateStorage;

  constructor() {
    this.acme = new ACME({
      directoryUrl:
        process.env.ACME_DIRECTORY_URL ||
        "https://acme-v02.api.letsencrypt.org/directory",
      accountEmail: process.env.ACME_ACCOUNT_EMAIL || "",
    });
    this.storage = new CertificateStorage();
  }

  /**
   * Provision new SSL certificate
   */
  async provision(options: CertificateOptions): Promise<Certificate> {
    // 1. Validate domain and options
    // 2. Check if certificate already exists
    // 3. Generate CSR
    // 4. Complete ACME challenge
    // 5. Receive certificate from Let's Encrypt
    // 6. Store certificate and private key
    // 7. Save metadata to database
    // 8. Emit ssl:provisioned event
    // 9. Return certificate info
  }

  /**
   * Renew existing certificate
   */
  async renew(domain: string): Promise<Certificate> {
    // 1. Load existing certificate
    // 2. Check if renewal needed (< 30 days)
    // 3. Generate new CSR
    // 4. Complete ACME challenge
    // 5. Receive new certificate
    // 6. Backup old certificate
    // 7. Store new certificate
    // 8. Update database
    // 9. Reload web server config
    // 10. Emit ssl:renewed event
  }

  /**
   * Revoke certificate
   */
  async revoke(domain: string, reason: string): Promise<void> {
    // 1. Load certificate
    // 2. Call ACME revoke API
    // 3. Update database status
    // 4. Archive certificate files
    // 5. Emit ssl:revoked event
  }

  /**
   * Get certificate by domain
   */
  async getCertificate(domain: string): Promise<Certificate | null> {
    // Query database and file system
  }

  /**
   * List all certificates
   */
  async listCertificates(filters?: {
    status?: string;
    expiringInDays?: number;
  }): Promise<Certificate[]> {
    // Query database with filters
  }

  /**
   * Check certificate expiry and mark expiring certificates
   */
  async checkExpiry(): Promise<void> {
    const certs = await this.listCertificates();
    const now = new Date();

    for (const cert of certs) {
      const daysUntilExpiry = Math.floor(
        (cert.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry <= 0) {
        await this.updateStatus(cert.domain, "expired");
        events.sslCertExpired?.(cert.domain);
      } else if (daysUntilExpiry <= 7) {
        await this.updateStatus(cert.domain, "expiring_soon");
        events.sslCertExpiringSoon?.(cert.domain, daysUntilExpiry);
      }
    }
  }

  private async updateStatus(domain: string, status: string): Promise<void> {
    // Update database
  }
}
```

#### 2. ACME Client

**File**: `parent-harness/orchestrator/src/ssl/acme-client.ts`

```typescript
import * as acme from "acme-client";

export interface ACMEOptions {
  directoryUrl: string;
  accountEmail: string;
}

export class ACME {
  private client: acme.Client;
  private accountKey: acme.forge.pki.rsa.PrivateKey;

  constructor(private options: ACMEOptions) {
    // Initialize ACME client
  }

  async createAccount(): Promise<void> {
    // Register with Let's Encrypt
    // Store account key securely
  }

  async completeHTTPChallenge(
    domain: string,
    challenge: acme.Challenge,
  ): Promise<void> {
    // Create challenge response file
    // Serve via /.well-known/acme-challenge/
  }

  async completeDNSChallenge(
    domain: string,
    challenge: acme.Challenge,
    provider: string,
  ): Promise<void> {
    // Create DNS TXT record via provider API
    // Wait for DNS propagation
    // Verify challenge
  }

  async requestCertificate(
    csr: Buffer,
    domain: string,
    challengeType: string,
  ): Promise<{ cert: string; chain: string }> {
    // Submit CSR to Let's Encrypt
    // Complete challenges
    // Poll for certificate
    // Return certificate and chain
  }

  async revokeCertificate(cert: Buffer, reason: string): Promise<void> {
    // Revoke via ACME API
  }
}
```

#### 3. Certificate Storage

**File**: `parent-harness/orchestrator/src/ssl/storage.ts`

```typescript
import * as fs from "fs/promises";
import * as path from "path";

export class CertificateStorage {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.SSL_STORAGE_PATH || "/app/data/ssl";
  }

  async saveCertificate(
    domain: string,
    cert: string,
    privateKey: string,
    chain: string,
  ): Promise<{ certPath: string; keyPath: string; chainPath: string }> {
    const certDir = path.join(this.baseDir, "certs", domain);
    const keyDir = path.join(this.baseDir, "private", domain);

    await fs.mkdir(certDir, { recursive: true });
    await fs.mkdir(keyDir, { recursive: true, mode: 0o700 });

    const certPath = path.join(certDir, "fullchain.pem");
    const keyPath = path.join(keyDir, "privkey.pem");
    const chainPath = path.join(certDir, "chain.pem");

    await fs.writeFile(certPath, cert, { mode: 0o644 });
    await fs.writeFile(keyPath, privateKey, { mode: 0o600 });
    await fs.writeFile(chainPath, chain, { mode: 0o644 });

    return { certPath, keyPath, chainPath };
  }

  async loadCertificate(domain: string): Promise<{
    cert: string;
    privateKey: string;
    chain: string;
  }> {
    // Read certificate files
  }

  async deleteCertificate(domain: string): Promise<void> {
    // Archive and delete certificate files
  }

  async backupCertificate(domain: string): Promise<string> {
    // Create timestamped backup
  }
}
```

#### 4. Configuration Generators

**File**: `parent-harness/orchestrator/src/ssl/config-generators.ts`

```typescript
export class NginxSSLConfig {
  static generate(domain: string, certPath: string, keyPath: string): string {
    return `
server {
    listen 443 ssl http2;
    server_name ${domain};

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://orchestrator:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name ${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
`;
  }
}

export class TraefikSSLConfig {
  static generate(domain: string): string {
    return `
http:
  routers:
    ${domain.replace(/\./g, "-")}:
      rule: "Host(\`${domain}\`)"
      service: orchestrator
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${process.env.ACME_ACCOUNT_EMAIL}
      storage: /data/ssl/acme.json
      httpChallenge:
        entryPoint: web
`;
  }
}
```

#### 5. Renewal Scheduler

**File**: `parent-harness/orchestrator/src/ssl/renewal-scheduler.ts`

```typescript
import { CronJob } from "cron";
import { SSLManager } from "./manager.js";
import * as telegram from "../telegram/index.js";

export class RenewalScheduler {
  private manager: SSLManager;
  private job: CronJob;

  constructor() {
    this.manager = new SSLManager();
  }

  start(): void {
    // Run daily at 2 AM
    this.job = new CronJob("0 2 * * *", async () => {
      await this.checkAndRenew();
    });
    this.job.start();
    console.log("🔐 SSL renewal scheduler started (daily at 2 AM)");
  }

  async checkAndRenew(): Promise<void> {
    console.log("🔐 Checking certificates for renewal...");

    const certificates = await this.manager.listCertificates({
      expiringInDays: 30,
    });

    for (const cert of certificates) {
      try {
        console.log(`🔐 Renewing certificate for ${cert.domain}...`);
        await this.manager.renew(cert.domain);

        telegram.send(
          `✅ SSL certificate renewed for ${cert.domain}\n` +
            `New expiry: ${cert.expiresAt.toISOString().split("T")[0]}`,
        );
      } catch (error) {
        console.error(`❌ Failed to renew ${cert.domain}:`, error);

        telegram.send(
          `⚠️ SSL renewal failed for ${cert.domain}\n` +
            `Error: ${error.message}\n` +
            `Manual intervention required!`,
        );
      }
    }

    console.log("🔐 Certificate renewal check complete");
  }

  stop(): void {
    this.job?.stop();
  }
}
```

#### 6. API Endpoints

**File**: `parent-harness/orchestrator/src/api/ssl.ts`

```typescript
import { Router } from "express";
import { SSLManager } from "../ssl/manager.js";

export const sslRouter = Router();
const manager = new SSLManager();

/**
 * GET /api/ssl/certificates
 * List all certificates
 */
sslRouter.get("/certificates", async (req, res) => {
  const filters = {
    status: req.query.status as string,
    expiringInDays: req.query.expiringInDays
      ? parseInt(req.query.expiringInDays as string)
      : undefined,
  };

  const certificates = await manager.listCertificates(filters);
  res.json({ certificates });
});

/**
 * GET /api/ssl/certificates/:domain
 * Get certificate by domain
 */
sslRouter.get("/certificates/:domain", async (req, res) => {
  const cert = await manager.getCertificate(req.params.domain);
  if (!cert) {
    return res.status(404).json({ error: "Certificate not found" });
  }
  res.json(cert);
});

/**
 * POST /api/ssl/provision
 * Provision new certificate
 */
sslRouter.post("/provision", async (req, res) => {
  const { domain, type, challengeType, altNames, dnsProvider } = req.body;

  try {
    const cert = await manager.provision({
      domain,
      type,
      challengeType,
      altNames,
      dnsProvider,
    });

    res.json({
      success: true,
      certificate: cert,
      message: `Certificate provisioned for ${domain}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ssl/renew/:domain
 * Manually trigger certificate renewal
 */
sslRouter.post("/renew/:domain", async (req, res) => {
  try {
    const cert = await manager.renew(req.params.domain);
    res.json({
      success: true,
      certificate: cert,
      message: "Certificate renewed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/ssl/certificates/:domain
 * Revoke certificate
 */
sslRouter.delete("/certificates/:domain", async (req, res) => {
  const { reason } = req.body;

  try {
    await manager.revoke(req.params.domain, reason);
    res.json({
      success: true,
      message: "Certificate revoked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

#### 7. CLI Tool

**File**: `parent-harness/orchestrator/src/cli/ssl-provision.ts`

```typescript
#!/usr/bin/env node
import { SSLManager } from "../ssl/manager.js";
import { Command } from "commander";

const program = new Command();

program
  .name("ssl-provision")
  .description("Provision SSL certificates via Let's Encrypt")
  .requiredOption("-d, --domain <domain>", "Domain name")
  .option(
    "-t, --type <type>",
    "Certificate type (single|wildcard|multi)",
    "single",
  )
  .option(
    "-c, --challenge <type>",
    "Challenge type (http-01|dns-01)",
    "http-01",
  )
  .option("--alt-names <names>", "Alternative domain names (comma-separated)")
  .option(
    "--dns-provider <provider>",
    "DNS provider (cloudflare|route53|digitalocean)",
  )
  .action(async (options) => {
    const manager = new SSLManager();

    console.log(`🔐 Provisioning SSL certificate for ${options.domain}...`);

    try {
      const cert = await manager.provision({
        domain: options.domain,
        type: options.type,
        challengeType: options.challenge,
        altNames: options.altNames?.split(","),
        dnsProvider: options.dnsProvider,
      });

      console.log("✅ Certificate provisioned successfully!");
      console.log(`   Domain: ${cert.domain}`);
      console.log(`   Expires: ${cert.expiresAt.toISOString()}`);
      console.log(`   Cert: ${cert.certPath}`);
      console.log(`   Key: ${cert.privateKeyPath}`);
    } catch (error) {
      console.error("❌ Provisioning failed:", error.message);
      process.exit(1);
    }
  });

program.parse();
```

**Package.json script**:

```json
{
  "scripts": {
    "ssl:provision": "tsx src/cli/ssl-provision.ts"
  }
}
```

### Integration with Existing Systems

#### 1. Health Checks

Add SSL certificate health to `/health` endpoint:

```typescript
// In parent-harness/orchestrator/src/api/health.ts
app.get("/health", async (req, res) => {
  const sslManager = new SSLManager();
  const sslHealth = await sslManager.listCertificates({ expiringInDays: 7 });

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    ssl: {
      certificates_expiring_soon: sslHealth.length,
      certificates: sslHealth.map((c) => ({
        domain: c.domain,
        daysUntilExpiry: c.daysUntilExpiry,
      })),
    },
  });
});
```

#### 2. Docker Compose Integration

Update `parent-harness/docker-compose.yml`:

```yaml
services:
  orchestrator:
    volumes:
      - ./data/ssl:/app/data/ssl:rw
    environment:
      - ACME_ACCOUNT_EMAIL=${ACME_ACCOUNT_EMAIL}
      - ACME_DIRECTORY_URL=${ACME_DIRECTORY_URL}
      - SSL_STORAGE_PATH=/app/data/ssl

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./data/ssl/certs:/etc/nginx/ssl/certs:ro
      - ./data/ssl/nginx:/etc/nginx/conf.d:ro
      - ./data/ssl/acme-challenge:/var/www/certbot:rw
    depends_on:
      - orchestrator
    networks:
      - harness-net
```

#### 3. WebSocket Events

Add SSL events to WebSocket broadcaster:

```typescript
// In parent-harness/orchestrator/src/db/events.ts
export const events = {
  sslProvisioned: (domain: string, expiresAt: Date) => {
    broadcast({
      type: "ssl:provisioned",
      data: { domain, expiresAt },
    });
  },

  sslRenewed: (domain: string, oldExpiry: Date, newExpiry: Date) => {
    broadcast({
      type: "ssl:renewed",
      data: { domain, oldExpiry, newExpiry },
    });
  },

  sslExpiringSoon: (domain: string, daysRemaining: number) => {
    broadcast({
      type: "ssl:expiring_soon",
      data: { domain, daysRemaining },
    });
  },

  sslExpired: (domain: string) => {
    broadcast({
      type: "ssl:expired",
      data: { domain },
    });
  },
};
```

---

## Pass Criteria

| #   | Criterion                                   | Validation Method                                            | Status     |
| --- | ------------------------------------------- | ------------------------------------------------------------ | ---------- |
| 1   | SSLManager class exists                     | Class exported from `src/ssl/manager.ts`                     | ⏳ Pending |
| 2   | ACME protocol integration for Let's Encrypt | `acme-client` package used, account registration works       | ⏳ Pending |
| 3   | Certificate provisioning workflow complete  | CLI tool provisions certificate successfully                 | ⏳ Pending |
| 4   | Auto-renewal scheduling implemented         | Cron job runs daily, renews expiring certificates            | ⏳ Pending |
| 5   | Secure certificate storage mechanism        | Private keys stored with 0600 permissions, certs in database | ⏳ Pending |
| 6   | Wildcard certificate support                | DNS-01 challenge works for `*.example.com`                   | ⏳ Pending |
| 7   | SSL config generation for Nginx/Traefik     | Config files generated and applied successfully              | ⏳ Pending |

### Validation Commands

```bash
# Test certificate provisioning
npm run ssl:provision -- --domain test.vibe.ai --challenge http-01

# Test wildcard provisioning
npm run ssl:provision -- --domain vibe.ai --type wildcard --challenge dns-01 --dns-provider cloudflare

# Check certificate storage
ls -la parent-harness/data/ssl/certs/test.vibe.ai/
ls -la parent-harness/data/ssl/private/test.vibe.ai/

# Verify database record
sqlite3 parent-harness/data/harness.db "SELECT * FROM ssl_certificates WHERE domain='test.vibe.ai';"

# Test renewal
npm run ssl:renew -- --domain test.vibe.ai

# Check health endpoint
curl http://localhost:3333/health?ssl=true

# Verify Nginx config generation
cat parent-harness/data/ssl/nginx/test.vibe.ai.conf
```

---

## Dependencies

### External Dependencies

| Dependency          | Version | Purpose                                | Installation                       |
| ------------------- | ------- | -------------------------------------- | ---------------------------------- |
| `acme-client`       | ^5.0.0  | ACME protocol client for Let's Encrypt | `npm install acme-client`          |
| `node-forge`        | ^1.3.1  | Cryptography for CSR generation        | `npm install node-forge`           |
| `cron`              | ^3.0.0  | Renewal scheduler                      | `npm install cron`                 |
| `@types/node-forge` | ^1.3.0  | TypeScript types                       | `npm install -D @types/node-forge` |

### DNS Provider SDKs (Optional)

| Provider     | Package                   | Purpose                     |
| ------------ | ------------------------- | --------------------------- |
| Cloudflare   | `cloudflare`              | DNS-01 challenge automation |
| AWS Route53  | `@aws-sdk/client-route53` | DNS-01 challenge automation |
| DigitalOcean | `do-wrapper`              | DNS-01 challenge automation |

### Internal Dependencies

| Module                  | Purpose                      |
| ----------------------- | ---------------------------- |
| `src/db/events.ts`      | WebSocket event broadcasting |
| `src/telegram/index.ts` | Alert notifications          |
| `src/config/index.ts`   | Configuration management     |
| `docker-compose.yml`    | Container orchestration      |

---

## Implementation Plan

### Phase 1: Core Infrastructure (3 hours)

1. **Database Schema** (30 min)
   - Create `ssl_certificates` table migration
   - Add indexes for performance
   - Test CRUD operations

2. **SSLManager Class** (1 hour)
   - Implement basic structure
   - Add database integration
   - Implement `getCertificate()` and `listCertificates()`

3. **Certificate Storage** (1 hour)
   - Implement `CertificateStorage` class
   - File system operations with proper permissions
   - Backup and archive functionality

4. **ACME Client** (30 min)
   - Install `acme-client` package
   - Initialize client with Let's Encrypt staging
   - Implement account registration

### Phase 2: Certificate Provisioning (2 hours)

5. **HTTP-01 Challenge** (1 hour)
   - Implement challenge response handler
   - Add endpoint `/.well-known/acme-challenge/:token`
   - Test with Let's Encrypt staging

6. **DNS-01 Challenge** (1 hour)
   - Implement Cloudflare DNS provider
   - Automatic TXT record creation
   - Challenge verification

### Phase 3: Renewal & Automation (2 hours)

7. **Auto-Renewal Scheduler** (1 hour)
   - Implement `RenewalScheduler` with cron
   - Expiry checking logic
   - Retry with exponential backoff

8. **Configuration Generators** (1 hour)
   - Nginx config template
   - Traefik config template
   - Docker Compose integration

### Phase 4: API & CLI (1 hour)

9. **API Endpoints** (30 min)
   - Implement REST API routes
   - Request validation
   - Error handling

10. **CLI Tool** (30 min)
    - Command-line provisioning tool
    - Help documentation
    - Interactive mode

### Phase 5: Testing & Documentation (30 min)

11. **Integration Testing**
    - Test full provisioning workflow
    - Test renewal process
    - Test wildcard certificates

12. **Documentation**
    - Update README with SSL instructions
    - Create runbook for production
    - Add troubleshooting guide

---

## Security Considerations

1. **Private Key Protection**
   - Never log private keys
   - File permissions: 0600 (owner read/write only)
   - Consider encryption at rest (future: gpg, vault)
   - Never commit keys to version control

2. **ACME Account Security**
   - Account keys stored in `/app/data/ssl/account/`
   - Separate from certificate keys
   - Backup account keys securely

3. **Challenge Response Security**
   - HTTP-01: Temporary files cleaned up after challenge
   - DNS-01: TXT records removed after validation
   - Rate limit protection (5 certs/domain/week)

4. **Certificate Validation**
   - Verify certificate after issuance
   - Check domain names match request
   - Validate expiry dates

5. **Access Control**
   - API endpoints require authentication (future)
   - CLI tool requires environment variables
   - Dashboard SSL view restricted to admins

---

## Monitoring and Alerts

### Metrics

```typescript
// Prometheus metrics
ssl_cert_expiry_days{domain="example.com"} 45
ssl_cert_renewal_success_total{domain="example.com"} 3
ssl_cert_renewal_failure_total{domain="example.com"} 0
ssl_provisioning_duration_seconds{domain="example.com"} 23.5
```

### Alert Rules

1. **Certificate Expiring Soon** (7 days)
   - Severity: Warning
   - Notification: Telegram
   - Action: Check renewal scheduler

2. **Certificate Expired**
   - Severity: Critical
   - Notification: Telegram + Email
   - Action: Manual intervention required

3. **Renewal Failed**
   - Severity: High
   - Notification: Telegram
   - Action: Check ACME logs, retry manually

4. **Certificate Missing**
   - Severity: Critical
   - Notification: Telegram
   - Action: Provision new certificate

---

## Troubleshooting Guide

### Common Issues

| Issue                   | Cause                              | Solution                                      |
| ----------------------- | ---------------------------------- | --------------------------------------------- |
| "Rate limit exceeded"   | Too many requests to Let's Encrypt | Wait 1 week or use staging environment        |
| "DNS challenge failed"  | DNS provider API error             | Check API credentials, verify DNS propagation |
| "HTTP challenge failed" | Port 80 not accessible             | Check firewall, verify nginx configuration    |
| "Certificate expired"   | Renewal cron not running           | Restart orchestrator, check cron logs         |
| "Permission denied"     | Incorrect file permissions         | Run `chmod 0600` on private keys              |

### Debug Mode

Enable verbose logging:

```bash
export SSL_DEBUG=true
npm run ssl:provision -- --domain example.com
```

### Manual Certificate Inspection

```bash
# View certificate details
openssl x509 -in /app/data/ssl/certs/example.com/fullchain.pem -text -noout

# Check expiry date
openssl x509 -in /app/data/ssl/certs/example.com/fullchain.pem -enddate -noout

# Verify private key
openssl rsa -in /app/data/ssl/private/example.com/privkey.pem -check
```

---

## Future Enhancements

1. **HSM Integration** - Hardware Security Module for key storage
2. **Multi-Region** - Certificate replication across regions
3. **OCSP Stapling** - Improved SSL performance
4. **Certificate Transparency** - CT log monitoring
5. **Custom CA Support** - Support for private CAs
6. **Automated Testing** - Staging environment testing before production

---

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [ACME Protocol RFC 8555](https://datatracker.ietf.org/doc/html/rfc8555)
- [acme-client npm package](https://www.npmjs.com/package/acme-client)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Docker SSL/TLS Best Practices](https://docs.docker.com/engine/security/https/)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Author:** Spec Agent (Autonomous)
**Status:** Specification Complete - Ready for Implementation
