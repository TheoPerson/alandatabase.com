export async function ingestAdultVideo(_video: unknown): Promise<null> {
	console.warn(
		'Legacy adult-source ingestion is quarantined. No external source or database record was written.'
	);
	return null;
}
