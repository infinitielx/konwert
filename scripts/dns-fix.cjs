// Local dev only: use public DNS so mongodb+srv:// SRV lookups work on networks that block them.
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
