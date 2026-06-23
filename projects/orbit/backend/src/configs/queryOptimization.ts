/**
 * Database Query Optimization and N+1 Prevention
 * 
 * This utility provides query optimization helpers to prevent N+1 queries
 * and optimize database performance.
 */

import mongoose from 'mongoose';

/**
 * Populate options for common fields to prevent N+1 queries
 */
export const POPULATE_AUTHOR = {
  path: 'author',
  select: 'username fullName profilePic followersCount followingCount',
};

export const POPULATE_AUTHOR_WITH_STATUS = {
  path: 'author',
  select: 'username fullName profilePic followersCount followingCount',
};

export const POPULATE_COMMENTS = {
  path: 'comments',
  populate: [
    {
      path: 'author',
      select: 'username fullName profilePic',
    },
    {
      path: 'reactions.sender',
      select: 'username fullName profilePic',
    },
  ],
};

export const POPULATE_LAST_MESSAGE = {
  path: 'lastMessage',
  populate: {
    path: 'sender',
    select: 'username fullName profilePic',
  },
};

/**
 * Query builder with automatic population
 */
export class OptimizedQueryBuilder {
  private query: mongoose.Query<any, any>;

  constructor(model: mongoose.Model<any>) {
    this.query = model.find();
  }

  /**
   * Add population for author
   */
  withAuthor(): this {
    this.query = this.query.populate(POPULATE_AUTHOR);
    return this;
  }

  /**
   * Add population for comments
   */
  withComments(): this {
    this.query = this.query.populate(POPULATE_COMMENTS);
    return this;
  }

  /**
   * Add pagination
   */
  paginate(page: number = 1, limit: number = 20): this {
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }

  /**
   * Add sorting
   */
  sort(sort: any): this {
    this.query = this.query.sort(sort);
    return this;
  }

  /**
   * Add selection
   */
  select(fields: string): this {
    this.query = this.query.select(fields);
    return this;
  }

  /**
   * Execute query
   */
  async exec(): Promise<any[]> {
    return this.query.exec();
  }

  /**
   * Execute query with count
   */
  async execWithCount(): Promise<{ data: any[]; total: number }> {
    const [data, total] = await Promise.all([
      this.query.exec(),
      this.query.model.countDocuments(this.query.getFilter()),
    ]);
    return { data, total };
  }
}

/**
 * Create optimized query builder
 */
export const createOptimizedQuery = (model: mongoose.Model<any>) => {
  return new OptimizedQueryBuilder(model);
};

/**
 * Batch populate helper for multiple documents
 */
export const batchPopulate = async (
  documents: any[],
  populateField: string,
  selectFields: string
): Promise<void> => {
  const ids = documents.map((doc) => doc[populateField]).filter(Boolean);
  
  if (ids.length === 0) return;

  const Model = mongoose.model(populateField.charAt(0).toUpperCase() + populateField.slice(1));
  const populatedDocs = await Model.find({ _id: { $in: ids } }).select(selectFields);

  const populatedMap = new Map(
    populatedDocs.map((doc) => [doc._id.toString(), doc])
  );

  documents.forEach((doc) => {
    const id = doc[populateField]?.toString();
    if (id) {
      doc[populateField] = populatedMap.get(id);
    }
  });
};

/**
 * Lean query optimization for read-only operations
 */
export const leanQuery = (query: mongoose.Query<any, any>): mongoose.Query<any, any> => {
  return query.lean();
};

/**
 * Projection optimization - only select needed fields
 */
export const selectOnly = (fields: string[]) => {
  return fields.join(' ');
};

/**
 * Common field sets for optimization
 */
export const FIELD_SETS = {
  POST_MINIMAL: '_id title content slug createdAt author likesCount savesCount repostsCount commentsCount viewsCount',
  POST_FULL: '_id title content slug hashtags images author createdAt likesCount savesCount repostsCount commentsCount sharesCount viewsCount pinned',
  USER_MINIMAL: '_id username fullName profilePic followersCount followingCount',
  USER_FULL: '_id username fullName email profilePic bannerImage followersCount followingCount bio website createdAt',
  COMMENT_MINIMAL: '_id content author createdAt likesCount',
  MESSAGE_MINIMAL: '_id content sender recipient createdAt reactions',
};
