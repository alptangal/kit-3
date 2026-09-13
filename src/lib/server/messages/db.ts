//$lib/server/messages/db.ts

import type { TranslateContent } from '$interfaces/basic';
import { couchbase } from '$modules/couchbase';
import type { CollectionName } from '$modules/schema';

const cb = couchbase;
const dataApi = cb.dataApi;
type ApiShape = ReturnType<typeof dataApi<CollectionName>>;
type MessageMapOf<T> = {
	[K in keyof T]: T[K] extends (...args: never[]) => unknown
		? { error: TranslateContent; success: TranslateContent } // là 1 method -> map thành message string
		: T[K] extends object
			? MessageMapOf<T[K]> // là object con -> đệ quy tiếp
			: never;
};

// 3. Type cuối cùng dùng cho users
type UsersMessages = MessageMapOf<ApiShape>;

const managementData = cb.managementData; // hoặc import trực tiếp nếu có export riêng

type ManagementApiShape = ReturnType<typeof managementData>;

type ManagementApiMessageMapOf<T> = {
	[K in keyof T]: T[K] extends (...args: never[]) => infer R
		? R extends Promise<unknown>
			? { error: TranslateContent; success: TranslateContent } // async method -> leaf message
			: R extends object
				? MessageMapOf<R> // factory function (sync, trả về object) -> đệ quy tiếp vào R
				: { error: TranslateContent; success: TranslateContent }
		: T[K] extends object
			? MessageMapOf<T[K]> // object con thường (như organizations, projects) -> đệ quy tiếp
			: never;
};

type ManagementMessages = ManagementApiMessageMapOf<ManagementApiShape>;

export const users: UsersMessages = {
	document: {
		get: {
			success: { vi: 'Lấy thông tin người dùng thành công', en: 'User fetched successfully' },
			error: { vi: 'Lấy thông tin người dùng thất bại', en: 'Failed to fetch user' }
		},
		create: {
			success: { vi: 'Tạo người dùng thành công', en: 'User created successfully' },
			error: { vi: 'Tạo người dùng thất bại', en: 'Failed to create user' }
		},
		update: {
			success: { vi: 'Cập nhật thông tin người dùng thành công', en: 'User updated successfully' },
			error: { vi: 'Cập nhật thông tin người dùng thất bại', en: 'Failed to update user' }
		},
		delete: {
			success: { vi: 'Xoá người dùng thành công', en: 'User deleted successfully' },
			error: { vi: 'Xoá người dùng thất bại', en: 'Failed to delete user' }
		},
		touch: {
			success: {
				vi: 'Cập nhật thời gian hết hạn tài khoản thành công',
				en: 'User expiry updated successfully'
			},
			error: {
				vi: 'Cập nhật thời gian hết hạn tài khoản thất bại',
				en: 'Failed to update user expiry'
			}
		},
		query: {
			success: {
				vi: 'Truy vấn dữ liệu người dùng thành công',
				en: 'User query executed successfully'
			},
			error: { vi: 'Truy vấn dữ liệu người dùng thất bại', en: 'Failed to execute user query' }
		}
	},
	query: {
		collection: {
			create: {
				success: {
					vi: 'Tạo bảng dữ liệu người dùng thành công',
					en: 'User collection created successfully'
				},
				error: {
					vi: 'Tạo bảng dữ liệu người dùng thất bại',
					en: 'Failed to create user collection'
				}
			},
			drop: {
				success: {
					vi: 'Xoá bảng dữ liệu người dùng thành công',
					en: 'User collection dropped successfully'
				},
				error: { vi: 'Xoá bảng dữ liệu người dùng thất bại', en: 'Failed to drop user collection' }
			},
			list: {
				success: {
					vi: 'Lấy danh sách bảng dữ liệu người dùng thành công',
					en: 'User collections listed successfully'
				},
				error: {
					vi: 'Lấy danh sách bảng dữ liệu người dùng thất bại',
					en: 'Failed to list user collections'
				}
			}
		},
		document: {
			search: {
				success: { vi: 'Tìm kiếm người dùng thành công', en: 'Users searched successfully' },
				error: { vi: 'Tìm kiếm người dùng thất bại', en: 'Failed to search users' }
			}
		},
		search: {
			getCount: {
				success: {
					vi: 'Lấy số lượng người dùng được index thành công',
					en: 'User index count fetched successfully'
				},
				error: {
					vi: 'Lấy số lượng người dùng được index thất bại',
					en: 'Failed to fetch user index count'
				}
			},
			searchIndex: {
				success: {
					vi: 'Tìm kiếm người dùng (full-text) thành công',
					en: 'User full-text search completed successfully'
				},
				error: {
					vi: 'Tìm kiếm người dùng (full-text) thất bại',
					en: 'User full-text search failed'
				}
			}
		}
	}
};
const management: ManagementMessages = {
	organizations: {
		get: {
			success: { vi: 'Lấy thông tin tổ chức thành công', en: 'Organization fetched successfully' },
			error: { vi: 'Lấy thông tin tổ chức thất bại', en: 'Failed to fetch organization' }
		},
		list: {
			success: { vi: 'Lấy danh sách tổ chức thành công', en: 'Organizations listed successfully' },
			error: { vi: 'Lấy danh sách tổ chức thất bại', en: 'Failed to list organizations' }
		},
		updateConfiguration: {
			success: {
				vi: 'Cập nhật cấu hình tổ chức thành công',
				en: 'Organization configuration updated successfully'
			},
			error: {
				vi: 'Cập nhật cấu hình tổ chức thất bại',
				en: 'Failed to update organization configuration'
			}
		}
	},
	projects: {
		create: {
			success: { vi: 'Tạo dự án thành công', en: 'Project created successfully' },
			error: { vi: 'Tạo dự án thất bại', en: 'Failed to create project' }
		},
		list: {
			success: { vi: 'Lấy danh sách dự án thành công', en: 'Projects listed successfully' },
			error: { vi: 'Lấy danh sách dự án thất bại', en: 'Failed to list projects' }
		},
		get: {
			success: { vi: 'Lấy thông tin dự án thành công', en: 'Project fetched successfully' },
			error: { vi: 'Lấy thông tin dự án thất bại', en: 'Failed to fetch project' }
		},
		update: {
			success: { vi: 'Cập nhật dự án thành công', en: 'Project updated successfully' },
			error: { vi: 'Cập nhật dự án thất bại', en: 'Failed to update project' }
		},
		delete: {
			success: { vi: 'Xoá dự án thành công', en: 'Project deleted successfully' },
			error: { vi: 'Xoá dự án thất bại', en: 'Failed to delete project' }
		}
	},
	cluster: {
		create: {
			success: { vi: 'Tạo cluster thành công', en: 'Cluster created successfully' },
			error: { vi: 'Tạo cluster thất bại', en: 'Failed to create cluster' }
		},
		list: {
			success: { vi: 'Lấy danh sách cluster thành công', en: 'Clusters listed successfully' },
			error: { vi: 'Lấy danh sách cluster thất bại', en: 'Failed to list clusters' }
		},
		get: {
			success: { vi: 'Lấy thông tin cluster thành công', en: 'Cluster fetched successfully' },
			error: { vi: 'Lấy thông tin cluster thất bại', en: 'Failed to fetch cluster' }
		},
		update: {
			success: { vi: 'Cập nhật cluster thành công', en: 'Cluster updated successfully' },
			error: { vi: 'Cập nhật cluster thất bại', en: 'Failed to update cluster' }
		},
		delete: {
			success: { vi: 'Xoá cluster thành công', en: 'Cluster deleted successfully' },
			error: { vi: 'Xoá cluster thất bại', en: 'Failed to delete cluster' }
		},
		getCapacityStatistics: {
			success: {
				vi: 'Lấy thống kê dung lượng thành công',
				en: 'Capacity statistics fetched successfully'
			},
			error: { vi: 'Lấy thống kê dung lượng thất bại', en: 'Failed to fetch capacity statistics' }
		},
		turnOn: {
			success: { vi: 'Bật cluster thành công', en: 'Cluster turned on successfully' },
			error: { vi: 'Bật cluster thất bại', en: 'Failed to turn on cluster' }
		},
		turnOff: {
			success: { vi: 'Tắt cluster thành công', en: 'Cluster turned off successfully' },
			error: { vi: 'Tắt cluster thất bại', en: 'Failed to turn off cluster' }
		}
	},
	buckets: {
		create: {
			success: { vi: 'Tạo bucket thành công', en: 'Bucket created successfully' },
			error: { vi: 'Tạo bucket thất bại', en: 'Failed to create bucket' }
		},
		list: {
			success: { vi: 'Lấy danh sách bucket thành công', en: 'Buckets listed successfully' },
			error: { vi: 'Lấy danh sách bucket thất bại', en: 'Failed to list buckets' }
		},
		get: {
			success: { vi: 'Lấy thông tin bucket thành công', en: 'Bucket fetched successfully' },
			error: { vi: 'Lấy thông tin bucket thất bại', en: 'Failed to fetch bucket' }
		},
		update: {
			success: { vi: 'Cập nhật bucket thành công', en: 'Bucket updated successfully' },
			error: { vi: 'Cập nhật bucket thất bại', en: 'Failed to update bucket' }
		},
		delete: {
			success: { vi: 'Xoá bucket thành công', en: 'Bucket deleted successfully' },
			error: { vi: 'Xoá bucket thất bại', en: 'Failed to delete bucket' }
		}
	},
	scopes: {
		create: {
			success: { vi: 'Tạo scope thành công', en: 'Scope created successfully' },
			error: { vi: 'Tạo scope thất bại', en: 'Failed to create scope' }
		},
		list: {
			success: { vi: 'Lấy danh sách scope thành công', en: 'Scopes listed successfully' },
			error: { vi: 'Lấy danh sách scope thất bại', en: 'Failed to list scopes' }
		},
		get: {
			success: { vi: 'Lấy thông tin scope thành công', en: 'Scope fetched successfully' },
			error: { vi: 'Lấy thông tin scope thất bại', en: 'Failed to fetch scope' }
		},
		delete: {
			success: { vi: 'Xoá scope thành công', en: 'Scope deleted successfully' },
			error: { vi: 'Xoá scope thất bại', en: 'Failed to delete scope' }
		}
	},
	collections: {
		create: {
			success: { vi: 'Tạo collection thành công', en: 'Collection created successfully' },
			error: { vi: 'Tạo collection thất bại', en: 'Failed to create collection' }
		},
		list: {
			success: { vi: 'Lấy danh sách collection thành công', en: 'Collections listed successfully' },
			error: { vi: 'Lấy danh sách collection thất bại', en: 'Failed to list collections' }
		},
		get: {
			success: { vi: 'Lấy thông tin collection thành công', en: 'Collection fetched successfully' },
			error: { vi: 'Lấy thông tin collection thất bại', en: 'Failed to fetch collection' }
		},
		update: {
			success: { vi: 'Cập nhật collection thành công', en: 'Collection updated successfully' },
			error: { vi: 'Cập nhật collection thất bại', en: 'Failed to update collection' }
		},
		delete: {
			success: { vi: 'Xoá collection thành công', en: 'Collection deleted successfully' },
			error: { vi: 'Xoá collection thất bại', en: 'Failed to delete collection' }
		}
	}
};
