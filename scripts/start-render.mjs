/** Render's private Postgres endpoint uses TLS with self-signed certificates.
 * Keep the ordinary server's stricter TLS default for all other deployments.
 * https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections
 */
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const url=new URL(process.env.DATABASE_URL||"http://invalid");
if(process.env.RENDER!=="true"||!["postgres:","postgresql:"].includes(url.protocol)||!/^dpg-[a-z0-9-]+$/.test(url.hostname))throw Error("Render startup requires its private PostgreSQL connection.");
// node-postgres parses sslmode=require as encrypted transport without CA validation.
// This exception is limited to Render's private, non-public database hostname.
url.searchParams.set("sslmode","require");
process.env.DATABASE_URL=url.toString();
process.env.NODE_ENV="production";
// Fail before boot if a driver change no longer requires encryption.
const {Client}=require("pg");
if(!new Client({connectionString:process.env.DATABASE_URL}).connectionParameters.ssl)throw Error("PostgreSQL encryption is required.");
await import("../dist/index.js");
