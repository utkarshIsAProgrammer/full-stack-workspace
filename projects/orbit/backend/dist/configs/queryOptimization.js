"use strict";
/**
 * Database Query Optimization and N+1 Prevention
 *
 * This utility provides query optimization helpers to prevent N+1 queries
 * and optimize database performance.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_SETS = exports.selectOnly = exports.leanQuery = exports.batchPopulate = exports.createOptimizedQuery = exports.OptimizedQueryBuilder = exports.POPULATE_LAST_MESSAGE = exports.POPULATE_COMMENTS = exports.POPULATE_AUTHOR_WITH_STATUS = exports.POPULATE_AUTHOR = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Populate options for common fields to prevent N+1 queries
 */
exports.POPULATE_AUTHOR = {
    path: 'author',
    select: 'username fullName profilePic followersCount followingCount',
};
exports.POPULATE_AUTHOR_WITH_STATUS = {
    path: 'author',
    select: 'username fullName profilePic followersCount followingCount',
};
exports.POPULATE_COMMENTS = {
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
exports.POPULATE_LAST_MESSAGE = {
    path: 'lastMessage',
    populate: {
        path: 'sender',
        select: 'username fullName profilePic',
    },
};
/**
 * Query builder with automatic population
 */
class OptimizedQueryBuilder {
    constructor(model) {
        this.query = model.find();
    }
    /**
     * Add population for author
     */
    withAuthor() {
        this.query = this.query.populate(exports.POPULATE_AUTHOR);
        return this;
    }
    /**
     * Add population for comments
     */
    withComments() {
        this.query = this.query.populate(exports.POPULATE_COMMENTS);
        return this;
    }
    /**
     * Add pagination
     */
    paginate(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        this.query = this.query.skip(skip).limit(limit);
        return this;
    }
    /**
     * Add sorting
     */
    sort(sort) {
        this.query = this.query.sort(sort);
        return this;
    }
    /**
     * Add selection
     */
    select(fields) {
        this.query = this.query.select(fields);
        return this;
    }
    /**
     * Execute query
     */
    async exec() {
        return this.query.exec();
    }
    /**
     * Execute query with count
     */
    async execWithCount() {
        const [data, total] = await Promise.all([
            this.query.exec(),
            this.query.model.countDocuments(this.query.getFilter()),
        ]);
        return { data, total };
    }
}
exports.OptimizedQueryBuilder = OptimizedQueryBuilder;
/**
 * Create optimized query builder
 */
const createOptimizedQuery = (model) => {
    return new OptimizedQueryBuilder(model);
};
exports.createOptimizedQuery = createOptimizedQuery;
/**
 * Batch populate helper for multiple documents
 */
const batchPopulate = async (documents, populateField, selectFields) => {
    const ids = documents.map((doc) => doc[populateField]).filter(Boolean);
    if (ids.length === 0)
        return;
    const Model = mongoose_1.default.model(populateField.charAt(0).toUpperCase() + populateField.slice(1));
    const populatedDocs = await Model.find({ _id: { $in: ids } }).select(selectFields);
    const populatedMap = new Map(populatedDocs.map((doc) => [doc._id.toString(), doc]));
    documents.forEach((doc) => {
        const id = doc[populateField]?.toString();
        if (id) {
            doc[populateField] = populatedMap.get(id);
        }
    });
};
exports.batchPopulate = batchPopulate;
/**
 * Lean query optimization for read-only operations
 */
const leanQuery = (query) => {
    return query.lean();
};
exports.leanQuery = leanQuery;
/**
 * Projection optimization - only select needed fields
 */
const selectOnly = (fields) => {
    return fields.join(' ');
};
exports.selectOnly = selectOnly;
/**
 * Common field sets for optimization
 */
exports.FIELD_SETS = {
    POST_MINIMAL: '_id title content slug createdAt author likesCount savesCount repostsCount commentsCount viewsCount',
    POST_FULL: '_id title content slug hashtags images author createdAt likesCount savesCount repostsCount commentsCount sharesCount viewsCount pinned',
    USER_MINIMAL: '_id username fullName profilePic followersCount followingCount',
    USER_FULL: '_id username fullName email profilePic bannerImage followersCount followingCount bio website createdAt',
    COMMENT_MINIMAL: '_id content author createdAt likesCount',
    MESSAGE_MINIMAL: '_id content sender recipient createdAt reactions',
};
//# sourceMappingURL=queryOptimization.js.map