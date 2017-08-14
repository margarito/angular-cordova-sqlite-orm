import { DbHelperModel } from '../db-helper-model.model';
import { retryWhen } from 'rxjs/operator/retryWhen';
import { QueryManager } from '../../managers/query-manager';
import { QueryResult } from '../../interfaces/query-result.interface';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { ModelManager } from '../../managers/model-manager';
import { DbQuery } from '../db-query.model';
import { ClauseGroup } from './clause-group.model';
import { Clause } from './clause.model';

/**
 * @private API
 * @class QueryUpdate is private part of the APi.
 * For design reasons this class should not be used directly and
 * will move later. Use this class with {@link Update} function.
 * 
 * @param T exdends {@link DbHelperModel}, a model declared with table and column annotations
 * 
 * @example
 * // update todo object
 * Update(todo).exec().subscribe((qr: QueryResult<any>) => {
 *      // do something with the result...
 * }, (err) => {
 *      // do something with the error...
 * });
 * 
 * @author  Olivier Margarit
 * @Since   0.1
 */
export class QueryUpdate<T extends DbHelperModel> {
    /**
     * @private
     * @property type the type of statement, should not be modified
     */
    private type = 'UPDATE';

    /**
     * @private
     * @property whereClauses is {@link ClauseGroup} instance containing
     * where clauses
     */
    private whereClauses: ClauseGroup;

    /**
     * @public
     * @constructor should not be use directly, see class header
     * 
     * @param model {@link DbHelperModel} extention
     */
    public constructor(private model: T, private partial: boolean = false) {}

    /**
     * @public
     * @method where is the method to add clauses to the where statement of the query
     * see {@link Clause} or {@link ClauseGroup}
     * 
     * @param clauses  ClauseGroup, Clause, Clause list of dictionnary of clauses
     * 
     * @return this instance to chain query instructions
     */
    public where(clauses: Clause|Clause[]|ClauseGroup|Object): QueryUpdate<T> {
        if (!this.whereClauses) {
            this.whereClauses = new ClauseGroup();
        }
        this.whereClauses.add(clauses);
        return this;
    }

    /**
     * @public
     * @method build should be removed to be a part of the private API
     * 
     * @return {@link DbQuery} of the query with the string part and
     *          clauses params.
     */
    public build(): DbQuery {
        const table = ModelManager.getInstance().getModel(this.model);
        const dbQuery = new DbQuery();
        dbQuery.table = table.name;
        dbQuery.type = this.type;
        if (this.model.__rowid) {
            const clause = new Clause();
            clause.key = 'rowid';
            clause.value = this.model.__rowid;
            this.where(clause);
        } else {
            for (const column of table.columnList) {
                if (column.primaryKey) {
                    const clause = new Clause();
                    clause.key = column.name;
                    clause.value = (this.model as {[index:string]:any})[column.field];
                    this.where(clause);
                }
            }
        }
        // setup values to update
        dbQuery.query += this.type + ' ' + dbQuery.table;
        const columnsToUpdate = <string[]>[];
        const values = [];
        for (const column of table.columnList) {
            if (this.model.__partialWithProjection) {
                if (this.model.__partialWithProjection.indexOf(column.name) >= 0 || (this.model as {[index:string]: any})[column.field]) {
                    columnsToUpdate.push(column.name);
                    values.push((this.model as {[index:string]: any})[column.field]);
                }
            } else {
                columnsToUpdate.push(column.name);
                values.push((this.model as {[index:string]: any})[column.field]);
            }
        }

        dbQuery.query += ' SET ' + columnsToUpdate.join(' = (?), ') + ' = (?) ';
        dbQuery.params = dbQuery.params.concat(values);

        if (this.whereClauses) {
            dbQuery.query += ' WHERE';
            dbQuery.append(this.whereClauses.build());
        }
        return dbQuery;
    }

    /**
     * @public
     * @method exec to execute the query and asynchronously retreive result.
     * 
     * @return observable to subscribe
     */
    public exec(): Observable<QueryResult<any>> {
        return QueryManager.getInstance().query(this.build());
    }
}

/**
 * @private API
 * @function Update is an helper to update models.
 * For a single model prefer use {@link DbHelperModel.save}
 * 
 * @param T exdends {@link DbHelperModel}, a model declared with table and column annotations
 * 
 * @example
 * // update todo object
 * Update(todo).exec().subscribe((qr: QueryResult<any>) => {
 *      // do something with the result...
 * }, (err) => {
 *      // do something with the error...
 * });
 * 
 * @author  Olivier Margarit
 * @Since   0.1
 */
export function Update<T extends DbHelperModel>(model: T, partial: boolean = false): QueryUpdate<T> {
    return new QueryUpdate(model, partial);
}