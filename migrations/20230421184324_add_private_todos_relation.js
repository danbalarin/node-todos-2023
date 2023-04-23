/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
    await knex.schema.alterTable('todos', (table) => {
        table.integer('user_id').unsigned()
        table.foreign('user_id').references('todos.id').deferrable('deferred')
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
    return knex.schema.alterTable('todos', (table) => {
        table.dropForeign('user_id')
        table.dropColumn('user_id')
    })
}
