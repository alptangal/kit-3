//$modules/couchbase.ts

import { randomUUID } from 'crypto';
import {
	assertOperatorAllowed,
	assertSearchableField,
	assertSelectableFields,
	assertSortableField,
	assertValueMatchesType,
	toN1qlOperator,
	type CollectionName,
	type Operator,
	type SearchableFieldOf,
	type SortableFieldOf,
	type SelectableFieldOf,
	type InferCollection
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
				| 'westus2'
				| 'westus3'
				| 'brazilsouth'
				| 'germanywestcentral'
				| 'norwayeast'
				| 'uksouth'
				| 'westeurope'
				| 'northeurope'
				| 'swedencentral'
				| 'switzerlandnorth'
				| 'uaenorth'
				| 'spaincentral'
				| 'francecentral'
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
			 *Only required for Ultra Disk types. Not used in other storage types. See IOPS Defaults for a list of supported IOPS values.
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
interface FtsSearchResult {
	status: number;
	ok: boolean;
	hits?: {
		id: string;
		score: number;
		fields?: Record<string, any>;
		fragments?: Record<string, string[]>;
	}[];
	total?: number;
	took?: string;
	message?: string;
}
const managementData = (data: { apiKeySecret: string; organizationId: string }) => {
	const { apiKeySecret, organizationId } = data;
	const baseUrl = 'https://cloudapi.cloud.couchbase.com';
	const headers = {
		authorization: `Bearer ${apiKeySecret}`,
		'content-type': 'application/json'
	};
	return {
		organizations: {
			async get() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}`, { headers });
					if (res.ok) {
						const jsonData = await res.json();

						return {
							data: jsonData,
							ok: true
						};
					}
					throw new Error(`[Organizations.get] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.organizations.get');
				}
			},
			async list() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations`, { headers });
					if (res.ok) {
						const jsonData = await res.json();
						return {
							data: jsonData['data'],
							ok: true
						};
					}
					throw new Error(`[Organizations.list] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.organizations.list');
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
						return { ok: true };
					}
					throw new Error(`[Organizations.updateConfiguration] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.organizations.updateConfiguration');
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
						const jsonData = await res.json();
						return {
							data: jsonData.id,
							ok: true
						};
					}
					throw new Error(`[Projects.create] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.projects.create');
				}
			},
			async list() {
				try {
					const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/projects`, {
						headers
					});
					if (res.ok) {
						const jsonData = await res.json();
						return { data: jsonData, ok: true };
					}
					throw new Error(`[Projects.list] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.project.list');
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
						const jsonData = await res.json();
						return { data: jsonData, ok: true };
					}
					throw new Error(`[Projects.get] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.projects.get');
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
						return { ok: true };
					}
					throw new Error(`[Projects.update] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.projects.update');
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
						return { ok: true };
					}
					throw new Error(`[Projects.delete] ${res.status} ${res.statusText}`);
				} catch (e) {
					throw normalizeError(e, 'couchbase.managementData.projects.delete');
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
							const jsonData = await res.json();
							return { data: jsonData.id, ok: true };
						}
						throw new Error(`[Clusters.create] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.create');
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
							const jsonData = await res.json();
							return {
								...jsonData,
								ok: true
							};
						}
						throw new Error(`[Clusters.list] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.list');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[Clusters.get] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.get');
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
							return { ok: true };
						}
						throw new Error(`[Clusters.update] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.update');
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
							return { ok: true };
						}
						throw new Error(`[Clusters.delete] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.delete');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[Clusters.getCapacityStatistics] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.getCapacityStatistics');
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
							return { ok: true };
						}
						throw new Error(`[Clusters.turnOn] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.turnOn');
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
							return { ok: true };
						}
						throw new Error(`[Clusters.turnOff] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.cluster.turnOff');
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
					durabilityLevel?: 'none' | 'majorityAndPersistActive' | 'majority' | 'persistToMajority';
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
							const jsonData = await res.json();
							return { data: jsonData.id, ok: true };
						}
						throw new Error(`[Buckets.create] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.buckets.create');
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
							const jsonData = await res.json();
							return { ...jsonData, ok: true };
						}
						throw new Error(`[Buckets.list] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.buckets.list');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[Buckets.get] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.buckets.get');
					}
				},
				async update(data: {
					bucketId: string;
					memoryAllocationInMb: number;
					durabilityLevel: 'none' | 'majorityAndPersistActive' | 'majority' | 'persistToMajority';
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
							return { ok: true };
						}
						throw new Error(`[Buckets.update] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.buckets.update');
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
							return { ok: true };
						}
						throw new Error(`[Buckets.delete] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.buckets.delete');
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
							return { ok: true };
						}
						throw new Error(`[Scopes.create] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.scopes.create');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[Scopes.list] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.scopes.list');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[scopes.get] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.scopes.get');
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
							return { ok: true };
						}
						throw new Error(`[Scopes.delete] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.scopes.delete');
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
							`${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections`,
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
							return { ok: true };
						}
						throw new Error(`[Collections.create] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.collections.create');
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
							const jsonData = await res.json();
							return { ...jsonData, ok: true };
						}
						throw new Error(`[Collections.list] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.collections.list');
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
							const jsonData = await res.json();
							return { data: jsonData, ok: true };
						}
						throw new Error(`[Collections.get] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.collections.get');
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
							return { ok: true };
						}
						throw new Error(`[Collections.update] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.collections.update');
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
							return { ok: true };
						}
						throw new Error(`[Collections.delete] ${res.status} ${res.statusText}`);
					} catch (e) {
						throw normalizeError(e, 'couchbase.managementData.collections.delete');
					}
				}
			};
		}
	};
};
// Đọc body lỗi an toàn (không throw nếu body rỗng/không phải text)
async function readErrorMessage(res: Response): Promise<string> {
	try {
		const text = await res.text();
		return text || res.statusText || `HTTP ${res.status}`;
	} catch {
		return res.statusText || `HTTP ${res.status}`;
	}
}

const dataApi = <C extends CollectionName>(data: {
	clusterId: string;
	username: string;
	password: string;
	bucketName: string;
	scopeName: string;
	collectionName: C;
}) => {
	const { clusterId, username, password, bucketName, scopeName, collectionName } = data;
	const headers = {
		authorization: `Basic ${btoa(`${username}:${password}`)}`,
		'content-type': 'application/json'
	};
	// SỬA: documentKey có thể chứa ký tự đặc biệt (blind index base64 có '/', '+', '=',
	// hoặc username tuỳ ý người dùng nhập) -> nếu ghép thẳng vào URL path sẽ tạo path sai
	// (vd '/' bị hiểu là phân cách thư mục), khiến get/update/delete nhắm sai document hoặc
	// lỗi 400/404 khó hiểu. Nay luôn encode trước khi ghép vào URL.
	const encodeKey = (documentKey: string) => encodeURIComponent(documentKey);
	// SỬA: Tách getDocument thành hàm riêng trong closure của dataApi thay vì dùng `this.get`.
	// Giúp tránh lỗi TypeError nếu phương thức update() bị destructure hoặc gọi không qua context `this`.
	const getDocument = async (data: { documentKey: string }): Promise<DocumentResponse> => {
		try {
			const { documentKey } = data;
			const res = await fetch(
				`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
				{
					headers
				}
			);
			const isOk = res.status < 400;
			return {
				status: res.status,
				...(isOk ? { data: await res.json() } : { message: await readErrorMessage(res) }),
				get ok() {
					return res.status < 400;
				}
			};
		} catch (e) {
			throw normalizeError(e, 'couchbase.dataApi.document.get');
		}
	};
	return {
		document: {
			get: getDocument,
			async create(data: {
				documentKey?: string;
				content: InferCollection<C>;
			}): Promise<DocumentResponse> {
				try {
					const { documentKey = randomUUID(), content } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
						{
							headers,
							method: 'post',
							body: JSON.stringify(content)
						}
					);
					const isOk = res.status < 400;
					return {
						status: res.status,
						...(isOk ? {} : { message: await readErrorMessage(res) }),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.dataApi.document.create');
				}
			},
			async update(data: {
				documentKey: string;
				content: Partial<InferCollection<C>>;
				overwriteAll?: boolean;
			}): Promise<DocumentResponse> {
				try {
					const { documentKey, content, overwriteAll = false } = data;
					let currentDocument = undefined;
					if (!overwriteAll) {
						// SỬA: Gọi trực tiếp getDocument thay vì this.get để an toàn context
						const response = await getDocument({ documentKey });
						if (response.ok) {
							currentDocument = response.data;
						}
					}
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
						{
							headers,
							method: 'put',
							body: JSON.stringify({ ...(currentDocument ?? {}), ...content })
						}
					);
					const isOk = res.status < 400;
					return {
						status: res.status,
						...(isOk ? {} : { message: await readErrorMessage(res) }),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.dataApi.document.update');
				}
			},
			async delete(data: { documentKey: string }): Promise<DocumentResponse> {
				try {
					const { documentKey } = data;
					const res = await fetch(
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
						{
							headers,
							method: 'delete'
						}
					);
					const isOk = res.status < 400;
					return {
						status: res.status,
						...(isOk ? {} : { message: await readErrorMessage(res) }),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.dataApi.document.delete');
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
						`https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}/touch`,
						{
							headers,
							method: 'post',
							body: JSON.stringify({
								expiry,
								returnContent
							})
						}
					);
					const isOk = res.status < 400;
					return {
						status: res.status,
						...(isOk ? {} : { message: await readErrorMessage(res) }),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.dataApi.document.touch');
				}
			},
			async query(data: {
				statement: string;
				readonly?: boolean;
				scan_consistency?: 'not_bounded' | 'at_plus' | 'request_plus' | 'statement_plus';
				metrics?: boolean;
				signature?: boolean;
				pretty?: boolean;
				profile?: 'off' | 'phases' | 'timings';
				controls?: boolean;
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
					// SỬA: trước đây luôn `data: await res.json()` RỒI mới xét `!isOk` để đọc thêm
					// `readErrorMessage(res)` (res.text()) — đọc body Response 2 lần. Lần đọc thứ 2
					// luôn thất bại vì stream đã bị tiêu thụ (bắt bởi try/catch trong readErrorMessage
					// nên không crash, nhưng message trả về chỉ còn statusText, mất toàn bộ nội dung
					// lỗi N1QL thật sự — rất khó debug). Nay chỉ đọc body ĐÚNG 1 LẦN bằng text(),
					// sau đó parse JSON từ text đó nếu cần.
					const bodyText = await res.text();
					const isOk = res.status < 400;
					let parsedBody: { [k: string]: any } | undefined = undefined;
					if (bodyText) {
						try {
							parsedBody = JSON.parse(bodyText);
						} catch {
							parsedBody = undefined;
						}
					}
					return {
						status: res.status,
						...(isOk
							? { data: parsedBody }
							: { message: bodyText || res.statusText || `HTTP ${res.status}` }),
						get ok() {
							return res.status < 400;
						}
					};
				} catch (e) {
					throw normalizeError(e, 'couchbase.dataApi.document.query');
				}
			}
		},
		get query() {
			const document = this.document;
			return {
				collection: {
					async create(data: { name: string }): Promise<DocumentResponse> {
						const { name } = data;
						// SỬA: `name` được ghép thẳng vào câu DDL (CREATE COLLECTION) — N1QL không hỗ trợ
						// tham số hoá tên định danh (identifier) như với giá trị dữ liệu, nên phải tự
						// whitelist ký tự hợp lệ để tránh N1QL injection nếu `name` từng đến từ input
						// ít tin cậy hơn dự kiến.
						if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
							throw new Error(`Invalid collection name: "${name}"`);
						}
						const statement = `CREATE COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
						const res = await document.query({ statement });
						return {
							status: res.status,
							...(res.ok ? {} : { message: res.message }),
							get ok() {
								return res.status < 400;
							}
						};
					},
					async drop(data: { name: string }): Promise<DocumentResponse> {
						const { name } = data;
						// SỬA: cùng lý do như create() ở trên.
						if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
							throw new Error(`Invalid collection name: "${name}"`);
						}
						const statement = `DROP COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
						const res = await document.query({ statement });
						return {
							status: res.status,
							...(res.ok ? {} : { message: res.message }),
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
						return {
							status: res.status,
							...(res.ok ? {} : { message: res.message }),
							get ok() {
								return res.status < 400;
							},
							...(res.ok && res.data ? { data: res.data.results } : {})
						};
					}
				},
				document: {
					async search(data: {
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
						// SỬA: Đặt alias `AS k` cho FROM keyspace và dùng `k.*` hoặc `k.field`.
						// Trong Couchbase N1QL, `SELECT META().id AS _id, * FROM collection` sẽ bọc toàn bộ trường vào
						// sub-object tên collection (`{ _id, users: { firstname, ... } }`).
						// Dùng `k.*` trả về object phẳng `{ _id, firstname, ... }` khớp trực tiếp với type của app.
						const selectClause =
							selectFields && selectFields.length
								? `META(k).id AS _id, ${assertSelectableFields(collectionName, selectFields)
										.map((f) => `k.\`${String(f)}\``)
										.join(', ')}`
								: `META(k).id AS _id, k.*`;

						// ----- WHERE clause -----
						const args: (string | number | boolean)[] = [];

						const whereClauses = conditions.map((cond) => {
							const { fieldName, keyword, operator = 'EQUALS' } = cond;
							const field = assertSearchableField(collectionName, fieldName);

							assertOperatorAllowed(field.type, operator, String(fieldName));
							assertValueMatchesType(field.type, keyword, String(fieldName));

							if (operator === 'CONTAINS') {
								args.push(`%${keyword}%`);
								return `LOWER(k.\`${String(fieldName)}\`) LIKE LOWER($${args.length})`;
							}

							args.push(keyword);
							return `k.\`${String(fieldName)}\` ${toN1qlOperator(operator)} $${args.length}`;
						});

						const whereClause = whereClauses.join(` ${logicalOperator} `);

						// ----- ORDER BY clause -----
						let orderClause = '';
						if (orderBy) {
							// Ném lỗi nếu field không được đánh dấu sortable trong schema — validate TRƯỚC khi
							// build chuỗi câu lệnh, tách riêng khỏi việc build orderClause cho dễ đọc.
							assertSortableField(collectionName, orderBy);
							orderClause = `ORDER BY k.\`${String(orderBy)}\` ${orderDirection === 'ASC' ? 'ASC' : 'DESC'}`;
						}

						// ----- LIMIT / OFFSET (ép number, không đưa qua args để tránh injection) -----
						const safeLimit =
							Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;
						const safeOffset =
							Number.isInteger(Number(offset)) && Number(offset) >= 0 ? Number(offset) : 0;
						const cappedLimit = Math.min(safeLimit, 100); // chặn limit quá lớn gây tốn RU

						const statement = `
							SELECT ${selectClause}
							FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` AS k
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
							...(res.ok && res.data ? { data: res.data.results } : { message: res.message })
						};
					}
				},
				/**
				 * Returns the number of documents indexed in the specified Search index.
				 * @indexName The name of the Search index definition. You must use the fully qualified name for the index, which includes the bucket and scope.
				 */
				search: {
					async getCount(data: { indexName: string }) {
						try {
							const { indexName } = data;
							const url = `https://${clusterId}.data.cloud.couchbase.com/_p/fts/api/index/${indexName}/count`;
							const res = await fetch(url, { headers });

							if (res.ok) {
								const jsonData = await res.json();
								return {
									status: res.status,
									get ok() {
										return res.status < 400;
									},
									count: jsonData.count
								};
							}

							const errorBody = await res.text();
							throw new Error(
								`[Search.getCount] ${res.status} ${res.statusText} — Body: ${errorBody}`
							);
						} catch (e) {
							throw normalizeError(e, 'couchbase.dataApi.query.search.getCount');
						}
					},
					/**
					 * Thực thi truy vấn Full Text Search trên 1 Search Index đã định nghĩa (scoped tới bucket/scope hiện tại).
					 * @indexName Tên index (không cần fully-qualified — endpoint đã scoped theo bucket/scope trong URL)
					 * @query FTS query object theo chuẩn Couchbase — có thể là match query, query string, boolean query...
					 *        Xem: https://docs.couchbase.com/server/current/fts/fts-query-string-syntax.html
					 * @size Số kết quả tối đa trả về (mặc định 10)
					 * @from Vị trí bắt đầu — dùng cho phân trang
					 * @fields Danh sách field muốn trả về trong "fields" của mỗi hit (mặc định chỉ trả id + score)
					 * @sort Cách sắp xếp — mặc định theo "-_score" (điểm liên quan giảm dần)
					 * @highlight Bật highlight đoạn text khớp — hữu ích cho UI hiển thị kết quả tìm kiếm
					 */
					async searchIndex(data: {
						indexName: string;
						query: Record<string, any>;
						size?: number;
						from?: number;
						fields?: string[];
						sort?: (string | Record<string, any>)[];
						highlight?: {
							style?: 'html' | 'ansi';
							fields?: string[];
						};
						facets?: Record<string, any>;
						explain?: boolean;
					}): Promise<FtsSearchResult> {
						try {
							const {
								indexName,
								query,
								size = 10,
								from = 0,
								fields,
								sort,
								highlight,
								facets,
								explain = false
							} = data;

							if (!indexName) throw new Error('indexName is required');
							if (!query) throw new Error('query is required');

							const safeSize = Number.isInteger(size) && size > 0 ? Math.min(size, 1000) : 10;
							const safeFrom = Number.isInteger(from) && from >= 0 ? from : 0;

							const url = `https://${clusterId}.data.cloud.couchbase.com/_p/fts/api/bucket/${bucketName}/scope/${scopeName}/index/${indexName}/query`;

							const res = await fetch(url, {
								method: 'post',
								headers,
								body: JSON.stringify({
									query,
									size: safeSize,
									from: safeFrom,
									...(fields ? { fields } : {}),
									...(sort ? { sort } : {}),
									...(highlight ? { highlight } : {}),
									...(facets ? { facets } : {}),
									explain
								})
							});

							if (res.ok) {
								const jsonData = await res.json();
								return {
									status: res.status,
									get ok() {
										return res.status < 400;
									},
									hits: jsonData.hits ?? [],
									total: jsonData.total_hits ?? 0,
									took: jsonData.took
								};
							}

							const errorBody = await res.text();
							return {
								status: res.status,
								get ok() {
									return false;
								},
								message: `${res.status} ${res.statusText} — Body: ${errorBody}`
							};
						} catch (e) {
							throw normalizeError(e, 'couchbase.search.searchIndex');
						}
					}
				}
			};
		}
	};
};

export const couchbase = {
	managementData,
	dataApi
};
