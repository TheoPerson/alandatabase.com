console.error(
	'Public explicit-content ingestion is disabled. No external request or database write was performed.'
);
process.exitCode = 1;
