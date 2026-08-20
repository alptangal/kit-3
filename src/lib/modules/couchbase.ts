import { randomUUID } from 'crypto';
import {
	assertOperatorAllowed,
	assertSearchableField,
	assertSelectableFields,
	assertSortableField,
	assertValueMatchesType,
	toN1qlOperator,
	type CollectionName,
	type FieldOf,
	type Operator,
	type SearchableFieldOf,
	type SortableFieldOf,
	type SelectableFieldOf
} from './schema';

// Helper dùng chung, thay thế mọi chỗ `throw new Error(JSON.stringify(e))`
function normalizeError(e: unknown, context: string): Error {
	if (e instanceof Error) {
		return new Error(`${context}: ${e.message}`, { cause: e });
	}
	return new Error(`${context}: ${String(e)}`);
}
type CloudProvider =
	| {
			type: 'aws';
			region:
				| 'us-east-1'
				| 'us-east-2'
				| 'us-west-2'
				| 'ca-central-1'
				| 'sa-east-1'
				| 'mx-central-1'
				| 'eu-central-1'
				| 'eu-west-1'
				| 'eu-west-2'
				| 'eu-west-3'
				| 'eu-north-1'
				| 'eu-south-1'
				| 'eu-central-2'
				| 'il-central-1'
				| 'me-central-1'
				| 'me-south-1'
				| 'af-south-1'
				| 'ap-southeast-1'
				| 'ap-northeast-1'
				| 'ap-northeast-2'
				| 'ap-south-1'
				| 'ap-east-1'
				| 'ap-south-2'
				| 'ap-southeast-3'
				| 'ap-southeast-7'
				| 'ap-southeast-2'
				| 'ap-southeast-4';
			cidr?: '10.1.30.0/23';
	  }
	| {
			type: 'gcp';
			region:
				| 'us-east1'
				| 'us-east4'
				| 'us-east5'
				| 'us-west1'
				| 'us-west2'
				| 'us-west3'
				| 'us-west4'
				| 'us-central1'
				| 'us-south1'
				| 'northamerica-northeast1'
				| 'northamerica-northeast2'
				| 'southamerica-east1'
				| 'southamerica-west1'
				| 'europe-west1'
				| 'europe-west2'
				| 'europe-west3'
				| 'europe-west4'
				| 'europe-west6'
				| 'europe-west8'
				| 'europe-west9'
				| 'europe-central2'
				| 'europe-north1'
				| 'europe-southwest1'
				| 'me-west1'
				| 'me-central2'
				| 'africa-south1'
				| 'asia-east1'
				| 'asia-east2'
				| 'asia-northeast1'
				| 'asia-northeast2'
				| 'asia-northeast3'
				| 'asia-south1'
				| 'asia-south2'
				| 'asia-southeast1'
				| 'asia-southeast2'
				| 'australia-southeast1'
				| 'australia-southeast2';
			cidr?: '10.1.30.0/23';
	  }
	| {
			type: 'azure';
			region:
				| 'eastus'
				| 'eastus2'
				| 'centralus'
				| 'southcentralus'
				| 'canadacentral'
				| 'westus2 '
				| 'westus3'
				| 'brazilsouth'
				| 'germanywestcentral'
				| 'norwayeast'
				| 'uksouth'
				| 'westeurope '
				| 'northeurope '
				| 'swedencentral'
				| 'switzerlandnorth'
				| 'uaenorth'
				| 'spaincentral '
				| 'francecentral '
				| 'australiaeast'
				| 'koreacentral'
				| 'centralindia'
				| 'eastasia'
				| 'southeastasia';
			cidr?: '10.1.30.0/23';
	  };
type Disk =
	| {
			type: 'gp3' | 'io2';
			/**
			 * storage must >=50
			 */
			storage: number;
			/**
			 * Please refer to documentation for supported IOPS.
			 */
			iops: number;
	  }
	| {
			type: 'P6' | 'P10' | 'P15' | 'P20' | 'P30' | 'P40' | 'P50' | 'P60' | 'Ultra';
			/**
			 * must >=64
			 * Storage in GB. Only required for Ultra Disk types. Not used in other storage types.
			 */
			storage?: 64 | 128 | 256 | 512 | 1024 | 2048 | 3072;
			/**
			 * Only required for Ultra Disk types. Not used in other storage types. See IOPS Defaults for a list of supported IOPS values.
			 */
			iops?: number;
			/**
			 *Determine if disk storage should automatically expand. Defaults to "false" if not specified.
			 */
			autoExpansion?: boolean;
	  }
	| {
			type: 'pd-ssd';
			/**
			 * must >=50
			 * Storage in GB. Please refer to documentation for supported storage.
			 */
			storage: number;
	  };
interface ServiceGroup {
	node: {
		compute: {
			cpu: number;
			ram: number;
		};
		disk: Disk;
	};
	numOfNodes?: number;
	services?: ('data' | 'query' | 'index' | 'search' | 'analytics' | 'eventing')[];
}
interface DocumentResponse {
	status: number;
	ok: boolean;
	data?: {
		[k: string]: any;
	};
	message?: string;
}
const managementData = (data: { apiKeySecret: string; organizationId: string }) => {
	const { apiKeySecret, organizationId } = data;
	const baseUrl = 'https://cloudapi.cloud.couchbase.com';
	const headers = {
		authorization: `Bearer ${apiKeySecret}`
	};
	return {
		organizations: {
			async get() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}`, { headers });
					if (res.ok) {
						return res.json();
					}
					throw new Error(`Get organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async list() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations`, { headers });
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async updateConfiguration(data: { subdomain: string }) {
				try {
					const { subdomain } = data;
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/configuration`, {
						method: 'put',
						headers,
						body: JSON.stringify({
							subdomain
						})
					});
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			}
		},
		projects: {
			async create(data: { name: string; description?: string }) {
				try {
					const { name, description } = data;
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/projects`, {
						method: 'post',
						headers,
						body: JSON.stringify({
							name,
							description
						})
					});
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async list() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/projects`, {
						headers
					});
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async get(data: { projectId: string }) {
				try {
					const { projectId } = data;
					const res = await fetch(
						`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
						{
							headers
						}
					);
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async update(data: { projectId: string; name: string; description?: string }) {
				try {
					const { projectId, name, description } = data;
					const res = await fetch(
						`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
						{
							headers,
							method: 'put',
							body: JSON.stringify({
								name,
								description
							})
						}
					);
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			},
			async delete(data: { projectId: string }) {
				try {
					const { projectId } = data;
					const res = await fetch(
						`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
						{
							headers,
							method: 'delete'
						}
					);
					if (res.ok) {
						return res.json();
					}
					throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
				} catch (e) {
					throw new Error(JSON.stringify(e));
				}
			}
		},
		cluster(data: { projectId: string }) {
			const { projectId } = data;
			return {
				async create(data: {
					name: string;
					description?: string;
					cloudProvider: CloudProvider;
					serviceGroups: ServiceGroup[];
					availability: {
						type: 'single' | 'multi';
					};
					support: {
						plan: 'basic' | 'developer pro' | 'enterprise';
						timezone?: 'ET' | 'GMT' | 'IST' | 'PT';
					};
				}) {
					try {
						const { name, description, cloudProvider, serviceGroups, availability, support } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters`,
							{
								method: 'post',
								headers,
								body: JSON.stringify({
									name,
									description,
									cloudProvider,
									serviceGroups,
									availability,
									support
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async list() {
					try {
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async get(data: { clusterId: string }) {
					try {
						const { clusterId } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async update(data: {
					clusterId: string;
					name: string;
					description: string;
					support: {
						plan: 'basic' | 'developer pro' | 'enterprise';
						timezone?: 'ET' | 'GMT' | 'IST' | 'PT';
					};
					serviceGroups: ServiceGroup[];
				}) {
					try {
						const { clusterId, name, description, support, serviceGroups } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
							{
								method: 'put',
								headers,
								body: JSON.stringify({
									name,
									description,
									support,
									serviceGroups
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async delete(data: { clusterId: string }) {
					try {
						const { clusterId } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
							{
								method: 'delete',
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async getCapacityStatistics(data: { clusterId: string }) {
					try {
						const { clusterId } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/stats`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async turnOn(data: { clusterId: string; turnOnLinkedAppService?: boolean }) {
					try {
						const { clusterId, turnOnLinkedAppService } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/activationState`,
							{
								method: 'post',
								headers,
								body: JSON.stringify({
									turnOnLinkedAppService
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async turnOff(data: { clusterId: string }) {
					try {
						const { clusterId } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/activationState`,
							{
								method: 'delete',
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				}
			};
		},
		buckets(data: { projectId: string; clusterId: string }) {
			const { projectId, clusterId } = data;
			return {
				async create(data: {
					name: string;
					type?: 'couchbase' | 'ephemeral';
					storageBackend?: 'couchstore' | 'magma';
					vbuckets?: 128 | 1024;
					memoryAllocationInMb?: number;
					bucketConflictResolution?: 'seqno' | 'lww';
					durabilityLevel?: 'none' | 'majority' | 'majorityAndPersistActive' | 'persistToMajority';
					replicas?: 1 | 2 | 3;
					flushEnabled?: boolean;
					timeToLiveInSeconds?: number;
					evictionPolicy?: 'fullEviction' | 'noEviction' | 'nruEviction';
					priority: number;
				}) {
					try {
						const {
							name,
							type = 'couchbase',
							storageBackend = 'couchstore',
							vbuckets = 128,
							memoryAllocationInMb = 100,
							bucketConflictResolution = 'seqno',
							durabilityLevel = 'none',
							replicas = 1,
							priority = 0,
							evictionPolicy = 'fullEviction',
							flushEnabled = false
						} = data;

						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets`,
							{
								method: 'post',
								headers,
								body: JSON.stringify({
									name,
									type,
									storageBackend,
									vbuckets,
									memoryAllocationInMb,
									bucketConflictResolution,
									durabilityLevel,
									replicas,
									priority,
									evictionPolicy,
									flushEnabled
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async list() {
					try {
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async get(data: { bucketId: string }) {
					try {
						const { bucketId } = data;

						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async update(data: {
					bucketId: string;
					memoryAllocationInMb: number;
					durabilityLevel: 'none' | 'majority' | 'majorityAndPersistActive' | 'persistToMajority';
					replicas: 1 | 2 | 3;
					flushEnabled?: boolean;
					timeToLiveInSeconds: number;
					enableCrossClusterVersioning?: boolean;
					priority?: number;
				}) {
					try {
						const {
							bucketId,
							memoryAllocationInMb,
							durabilityLevel,
							replicas,
							flushEnabled = false,
							timeToLiveInSeconds,
							enableCrossClusterVersioning,
							priority = 0
						} = data;

						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
							{
								method: 'put',
								headers,
								body: JSON.stringify({
									memoryAllocationInMb,
									durabilityLevel,
									replicas,
									flushEnabled,
									timeToLiveInSeconds,
									enableCrossClusterVersioning,
									priority
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async delete(data: { bucketId: string }) {
					try {
						const { bucketId } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
							{
								method: 'delete',
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				}
			};
		},
		scopes(data: { projectId: string; clusterId: string; bucketId: string }) {
			const { projectId, clusterId, bucketId } = data;
			return {
				async create(data: { name: string }) {
					try {
						const { name } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes`,
							{
								method: 'post',
								headers,
								body: JSON.stringify({
									name
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async list() {
					try {
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async get(data: { scopeName: string }) {
					try {
						const { scopeName } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async delete(data: { scopeName: string }) {
					try {
						const { scopeName } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}`,
							{
								headers,
								method: 'delete'
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				}
			};
		},
		collections(data: {
			projectId: string;
			clusterId: string;
			bucketId: string;
			scopeName: string;
		}) {
			const { projectId, clusterId, bucketId, scopeName } = data;
			return {
				async create(data: { name: string; maxTTL?: number }) {
					try {
						const { name, maxTTL } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}`,
							{
								headers,
								method: 'post',
								body: JSON.stringify({
									name,
									maxTTL
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async list() {
					try {
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async get(data: { collectionName: string }) {
					try {
						const { collectionName } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
							{
								headers
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async update(data: { collectionName: string; maxTTL: number }) {
					try {
						const { collectionName, maxTTL } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
							{
								headers,
								method: 'put',
								body: JSON.stringify({
									maxTTL
								})
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				},
				async delete(data: { collectionName: string }) {
					try {
						const { collectionName } = data;
						const res = await fetch(
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
							{
								headers,
								method: 'delete'
							}
						);
						if (res.ok) {
							return res.json();
						}
						throw new Error(`List organizations failed: ${res.status} ${res.statusText}`);
					} catch (e) {
						throw new Error(JSON.stringify(e));
					}
				}
			};
		}
	};
};
const dataApi = (data: {
	clusterId: string;
	username: string;
	password: string;
	bucketName: string;
	scopeName: string;
	collectionName: string;
}) => {
	const { clusterId, username, password, bucketName, scopeName, collectionName } = data;
	const headers = {
		authorization: `Basic ${btoa(`${username}:${password}`)}`,
		'content-type': 'application/json'
	};
	return {
		document: {
			async get(data: { documentKey: string }): Promise<DocumentResponse> {
				try {
					const { documentKey } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${documentKey}`,
						{
							headers
						}
					);
					return {
						status: res.status,
						...(res.status < 400 ? { data: await res.json() } : {}),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.get');
				}
			},
			async create(data: {
				documentKey?: string;
				content: { [k: string]: any };
			}): Promise<DocumentResponse> {
				try {
					const { documentKey = randomUUID(), content } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${documentKey}`,
						{
							headers,
							method: 'post',
							body: JSON.stringify(content)
						}
					);
					return {
						status: res.status,
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.create');
				}
			},
			async update(data: {
				documentKey: string;
				content: { [k: string]: any };
			}): Promise<DocumentResponse> {
				try {
					const { documentKey, content } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${documentKey}`,
						{
							headers,
							method: 'put',
							body: JSON.stringify(content)
						}
					);
					return {
						status: res.status,
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.update');
				}
			},
			async delete(data: { documentKey: string }): Promise<DocumentResponse> {
				try {
					const { documentKey } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${documentKey}`,
						{
							headers,
							method: 'delete'
						}
					);
					return {
						status: res.status,
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.delete');
				}
			},
			async touch(data: {
				documentKey: string;
				/**
				 * The new expiry to set for the document, specified as an ISO8601 string.
				 */
				expiry: string;
				returnContent: boolean;
			}): Promise<DocumentResponse> {
				try {
					const { documentKey, expiry, returnContent } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${documentKey}/touch`,
						{
							headers,
							method: 'post',
							body: JSON.stringify({
								expiry,
								returnContent
							})
						}
					);
					return {
						status: res.status,
						...(res.status == 200 ? { data: await res.json() } : {}),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.touch');
				}
			},
			async query(data: {
				statement: string;
				readonly?: boolean;
				scanConsistency?: 'not_bounded' | 'at_plus' | 'request_plus' | 'statement_plus';
				metrics?: boolean;
				signature?: boolean;
				pretty?: boolean;
				profile?: 'off' | 'phases' | 'timings';
				control?: boolean;
				client_context_id?: string;
				format?: 'JSON' | 'XML' | 'CSV' | 'TSV';
				compression?: 'ZIP' | 'RLE' | 'LZMA' | 'LZO' | 'NONE';
				timeout?: `${number}s` | `${number}ms` | `${number}m` | `${number}h` | `${number}us`;
				[k: string]: any;
			}): Promise<DocumentResponse> {
				try {
					const {
						statement,
						readonly = false,
						scan_consistency = 'request_plus',
						profile = 'timings',
						format = 'JSON',
						compression = 'NONE',
						timeout = '10s',
						metrics = true,
						pretty = false,
						controls = false,
						...options
					} = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/_p/query/query/service`,
						{
							headers,
							method: 'post',
							body: JSON.stringify({
								statement,
								readonly,
								scan_consistency,
								profile,
								format,
								compression,
								timeout,
								metrics,
								pretty,
								controls,
								...options
							})
						}
					);
					return {
						status: res.status,
						...(res.status < 400 ? { data: await res.json() } : {}),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.document.query');
				}
			}
		},
		get query() {
			const document = this.document;
			return {
				collection: {
					async create(data: { name: string }): Promise<DocumentResponse> {
						const { name } = data;
						const statement = `CREATE COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
						const res = await document.query({ statement });
						return {
							status: res.status,
							get ok() {
								return res.status < 400;
							}
						};
					},
					async drop(data: { name: string }): Promise<DocumentResponse> {
						const { name } = data;
						const statement = `DROP COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
						const res = await document.query({ statement });
						return {
							status: res.status,
							get ok() {
								return res.status < 400;
							}
						};
					},
					async list(): Promise<DocumentResponse> {
						const statement = `SELECT name
						FROM system:keyspaces
						WHERE \`bucket\` = "${bucketName}" AND \`scope\` = "${scopeName}";`;
						const res = await document.query({ statement });
						console.log(res);
						return {
							status: res.status,
							get ok() {
								return res.status < 400;
							},
							...(res.ok && res.data ? { data: res.data.results } : {})
						};
					}
				},
				document: {
					async search<C extends CollectionName>(data: {
						collectionName: C;
						conditions: {
							fieldName: SearchableFieldOf<C>;
							keyword: string | number | boolean;
							operator?: Operator;
						}[];
						logicalOperator?: 'AND' | 'OR';
						selectFields?: SelectableFieldOf<C>[];
						orderBy?: SortableFieldOf<C>;
						orderDirection?: 'ASC' | 'DESC';
						limit?: number;
						offset?: number;
					}): Promise<DocumentResponse> {
						const {
							collectionName,
							conditions,
							logicalOperator = 'AND',
							selectFields,
							orderBy,
							orderDirection = 'DESC',
							limit = 20,
							offset = 0
						} = data;

						if (!conditions || conditions.length === 0) {
							throw new Error('At least one condition is required');
						}

						// ----- SELECT clause -----
						const selectClause =
							selectFields && selectFields.length
								? `META().id AS _id, ${assertSelectableFields(collectionName, selectFields)
										.map((f) => `\`${String(f)}\``)
										.join(', ')}`
								: `META().id AS _id, *`;

						// ----- WHERE clause -----
						const args: (string | number | boolean)[] = [];

						const whereClauses = conditions.map((cond) => {
							const { fieldName, keyword, operator = 'EQUALS' } = cond;
							const field = assertSearchableField(collectionName, fieldName);

							assertOperatorAllowed(field.type, operator, String(fieldName));
							assertValueMatchesType(field.type, keyword, String(fieldName));

							if (operator === 'CONTAINS') {
								args.push(`%${keyword}%`);
								return `LOWER(\`${String(fieldName)}\`) LIKE LOWER($${args.length})`;
							}

							args.push(keyword);
							return `\`${String(fieldName)}\` ${toN1qlOperator(operator)} $${args.length}`;
						});

						const whereClause = whereClauses.join(` ${logicalOperator} `);

						// ----- ORDER BY clause -----
						const orderClause = orderBy
							? `ORDER BY \`${String(assertSortableField(collectionName, orderBy) && orderBy)}\` ${
									orderDirection === 'ASC' ? 'ASC' : 'DESC'
								}`
							: '';

						// ----- LIMIT / OFFSET (ép number, không đưa qua args để tránh injection) -----
						const safeLimit =
							Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;
						const safeOffset =
							Number.isInteger(Number(offset)) && Number(offset) >= 0 ? Number(offset) : 0;
						const cappedLimit = Math.min(safeLimit, 100); // chặn limit quá lớn gây tốn RU

						const statement = `
							SELECT ${selectClause}
							FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\`
							WHERE ${whereClause}
							${orderClause}
							LIMIT ${cappedLimit}
							OFFSET ${safeOffset}
						`.trim();

						const res = await document.query({ statement, args, readonly: true });

						return {
							status: res.status,
							get ok() {
								return res.status < 400;
							},
							...(res.ok && res.data ? { data: res.data.results } : {})
						};
					}
				}
			};
		}
	};
};

export const couchbase = () => {
	return {
		managementData,
		dataApi
	};
};
