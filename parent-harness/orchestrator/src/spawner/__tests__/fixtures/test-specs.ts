/**
 * Test fixtures for feature specifications
 * VIBE-P13-010
 */

import type { FeatureSpec } from '../../feature-orchestrator.js';

/**
 * Simple database-only feature
 */
export const databaseOnlySpec: FeatureSpec = {
  id: 'test-db-only',
  name: 'Database Only Feature',
  description: 'Simple database table creation',
  layers: {
    database: {
      tables: [
        {
          name: 'tasks',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'title', type: 'TEXT', nullable: false },
            { name: 'completed', type: 'INTEGER', defaultValue: '0' }
          ]
        }
      ],
      indexes: [
        { table: 'tasks', columns: ['title'] }
      ]
    }
  }
};

/**
 * API-only feature (requires database)
 */
export const apiOnlySpec: FeatureSpec = {
  id: 'test-api-only',
  name: 'API Only Feature',
  description: 'REST API endpoints',
  layers: {
    api: {
      endpoints: [
        {
          method: 'GET',
          path: '/api/tasks',
          handler: 'getAllTasks',
          responseBody: {
            name: 'TaskListResponse',
            fields: {
              tasks: 'Task[]',
              total: 'number'
            }
          }
        },
        {
          method: 'POST',
          path: '/api/tasks',
          handler: 'createTask',
          requestBody: {
            name: 'CreateTaskRequest',
            fields: {
              title: 'string',
              description: 'string'
            }
          },
          responseBody: {
            name: 'TaskResponse',
            fields: {
              id: 'string',
              title: 'string'
            }
          }
        }
      ]
    }
  }
};

/**
 * Full-stack feature with all three layers
 */
export const fullStackSpec: FeatureSpec = {
  id: 'test-full-stack',
  name: 'User Management Feature',
  description: 'Complete user management with database, API, and UI',
  layers: {
    database: {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'email', type: 'TEXT', nullable: false, unique: true },
            { name: 'username', type: 'TEXT', nullable: false },
            { name: 'created_at', type: 'TEXT', defaultValue: "datetime('now')" }
          ],
          foreignKeys: []
        }
      ],
      indexes: [
        { table: 'users', columns: ['email'], unique: true },
        { table: 'users', columns: ['username'] }
      ]
    },
    api: {
      endpoints: [
        {
          method: 'GET',
          path: '/api/users/:id',
          handler: 'getUserById',
          pathParams: [
            { name: 'id', type: 'string', required: true }
          ],
          responseBody: {
            name: 'UserResponse',
            fields: {
              id: 'string',
              email: 'string',
              username: 'string',
              createdAt: 'string'
            }
          },
          auth: true
        },
        {
          method: 'POST',
          path: '/api/users',
          handler: 'createUser',
          requestBody: {
            name: 'CreateUserRequest',
            fields: {
              email: 'string',
              username: 'string',
              password: 'string'
            }
          },
          responseBody: {
            name: 'UserResponse',
            fields: {
              id: 'string',
              email: 'string',
              username: 'string'
            }
          }
        },
        {
          method: 'PUT',
          path: '/api/users/:id',
          handler: 'updateUser',
          pathParams: [
            { name: 'id', type: 'string', required: true }
          ],
          requestBody: {
            name: 'UpdateUserRequest',
            fields: {
              username: 'string',
              email: 'string'
            }
          },
          responseBody: {
            name: 'UserResponse',
            fields: {
              id: 'string',
              email: 'string',
              username: 'string'
            }
          },
          auth: true
        }
      ],
      middleware: ['authMiddleware', 'validateRequest']
    },
    ui: {
      components: [
        {
          name: 'UserList',
          path: 'frontend/src/components/UserList.tsx',
          props: {
            users: 'User[]',
            onUserClick: '(userId: string) => void'
          },
          apiCalls: ['GET /api/users']
        },
        {
          name: 'UserCard',
          path: 'frontend/src/components/UserCard.tsx',
          props: {
            user: 'User',
            onEdit: '() => void',
            onDelete: '() => void'
          }
        },
        {
          name: 'UserForm',
          path: 'frontend/src/components/UserForm.tsx',
          props: {
            user: 'User | null',
            onSubmit: '(user: User) => void',
            onCancel: '() => void'
          },
          apiCalls: ['POST /api/users', 'PUT /api/users/:id']
        }
      ],
      routes: [
        { path: '/users', component: 'UserList' },
        { path: '/users/:id', component: 'UserProfile' }
      ],
      hooks: [
        {
          name: 'useUsers',
          endpoint: '/api/users',
          returnType: 'User[]'
        },
        {
          name: 'useUser',
          endpoint: '/api/users/:id',
          returnType: 'User | null'
        }
      ]
    }
  },
  metadata: {
    priority: 'high',
    category: 'core',
    estimatedEffort: 'medium'
  }
};

/**
 * Feature with validation issues
 */
export const invalidSpec: FeatureSpec = {
  id: 'test-invalid',
  name: 'Invalid Feature',
  description: 'Feature with cross-layer inconsistencies',
  layers: {
    database: {
      tables: [
        {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'name', type: 'TEXT', nullable: false },
            { name: 'price', type: 'REAL', nullable: false }
          ]
        }
      ]
    },
    api: {
      endpoints: [
        {
          method: 'GET',
          path: '/api/products/:id',
          handler: 'getProductById',
          // References non-existent column
          responseBody: {
            name: 'ProductResponse',
            fields: {
              'products.id': 'string',
              'products.name': 'string',
              'products.description': 'string' // Doesn't exist in DB
            }
          }
        }
      ]
    },
    ui: {
      components: [
        {
          name: 'ProductList',
          path: 'frontend/src/components/ProductList.tsx',
          props: {},
          // References non-existent endpoint
          apiCalls: ['GET /api/products/search']
        }
      ]
    }
  }
};

/**
 * Complex multi-table feature
 */
export const complexSpec: FeatureSpec = {
  id: 'test-complex',
  name: 'Blog Platform',
  description: 'Multi-table blog platform with posts, comments, and tags',
  layers: {
    database: {
      tables: [
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'title', type: 'TEXT', nullable: false },
            { name: 'content', type: 'TEXT', nullable: false },
            { name: 'author_id', type: 'INTEGER', nullable: false },
            { name: 'created_at', type: 'TEXT', defaultValue: "datetime('now')" }
          ],
          foreignKeys: [
            {
              column: 'author_id',
              references: { table: 'users', column: 'id' },
              onDelete: 'CASCADE'
            }
          ]
        },
        {
          name: 'comments',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'post_id', type: 'INTEGER', nullable: false },
            { name: 'author_id', type: 'INTEGER', nullable: false },
            { name: 'content', type: 'TEXT', nullable: false },
            { name: 'created_at', type: 'TEXT', defaultValue: "datetime('now')" }
          ],
          foreignKeys: [
            {
              column: 'post_id',
              references: { table: 'posts', column: 'id' },
              onDelete: 'CASCADE'
            },
            {
              column: 'author_id',
              references: { table: 'users', column: 'id' },
              onDelete: 'CASCADE'
            }
          ]
        },
        {
          name: 'tags',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'name', type: 'TEXT', nullable: false, unique: true }
          ]
        },
        {
          name: 'post_tags',
          columns: [
            { name: 'post_id', type: 'INTEGER', nullable: false },
            { name: 'tag_id', type: 'INTEGER', nullable: false }
          ],
          foreignKeys: [
            {
              column: 'post_id',
              references: { table: 'posts', column: 'id' },
              onDelete: 'CASCADE'
            },
            {
              column: 'tag_id',
              references: { table: 'tags', column: 'id' },
              onDelete: 'CASCADE'
            }
          ]
        }
      ],
      indexes: [
        { table: 'posts', columns: ['author_id'] },
        { table: 'posts', columns: ['created_at'] },
        { table: 'comments', columns: ['post_id'] },
        { table: 'comments', columns: ['author_id'] },
        { table: 'post_tags', columns: ['post_id', 'tag_id'], unique: true }
      ]
    },
    api: {
      endpoints: [
        {
          method: 'GET',
          path: '/api/posts',
          handler: 'getAllPosts',
          queryParams: [
            { name: 'page', type: 'number', required: false },
            { name: 'limit', type: 'number', required: false },
            { name: 'tag', type: 'string', required: false }
          ],
          responseBody: {
            name: 'PostListResponse',
            fields: {
              posts: 'Post[]',
              total: 'number',
              page: 'number',
              hasMore: 'boolean'
            }
          }
        },
        {
          method: 'GET',
          path: '/api/posts/:id',
          handler: 'getPostById',
          pathParams: [
            { name: 'id', type: 'string', required: true }
          ],
          responseBody: {
            name: 'PostDetailResponse',
            fields: {
              post: 'Post',
              comments: 'Comment[]',
              tags: 'Tag[]'
            }
          }
        },
        {
          method: 'POST',
          path: '/api/posts',
          handler: 'createPost',
          requestBody: {
            name: 'CreatePostRequest',
            fields: {
              title: 'string',
              content: 'string',
              tagIds: 'number[]'
            }
          },
          responseBody: {
            name: 'PostResponse',
            fields: {
              id: 'string',
              title: 'string',
              content: 'string'
            }
          },
          auth: true
        }
      ]
    },
    ui: {
      components: [
        {
          name: 'PostList',
          path: 'frontend/src/components/PostList.tsx',
          props: {
            posts: 'Post[]',
            onPostClick: '(postId: string) => void'
          },
          apiCalls: ['GET /api/posts']
        },
        {
          name: 'PostDetail',
          path: 'frontend/src/components/PostDetail.tsx',
          props: {
            postId: 'string'
          },
          apiCalls: ['GET /api/posts/:id']
        },
        {
          name: 'CommentList',
          path: 'frontend/src/components/CommentList.tsx',
          props: {
            comments: 'Comment[]'
          }
        }
      ],
      hooks: [
        {
          name: 'usePosts',
          endpoint: '/api/posts',
          returnType: 'PostListResponse'
        },
        {
          name: 'usePost',
          endpoint: '/api/posts/:id',
          returnType: 'PostDetailResponse'
        }
      ]
    }
  }
};
