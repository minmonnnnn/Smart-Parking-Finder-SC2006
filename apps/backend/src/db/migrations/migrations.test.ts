import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = new URL('.', import.meta.url)
const readMigration = (name: string) =>
  readFileSync(new URL(name, migrationsDirectory), 'utf8')

const policyStatements = (sql: string) => sql.toLowerCase().match(/create policy[^;]*;/g) ?? []

const expectOwnerPolicy = (
  sql: string,
  table: string,
  command: string,
  ownerColumn: string,
  clauses: string[],
) => {
  const policies = policyStatements(sql).filter(
    (statement) =>
      new RegExp(`\\bon public\\.${table}\\b`).test(statement) &&
      new RegExp(`\\bfor (?:all|${command})\\b`).test(statement),
  )

  expect(policies, `expected ${command} policy on public.${table}`).not.toHaveLength(0)

  for (const policy of policies) {
    for (const clause of clauses) {
      expect(policy).toMatch(
        new RegExp(`\\b${clause}\\s*\\(\\s*auth\\.uid\\(\\)\\s*=\\s*${ownerColumn}\\s*\\)`),
      )
    }
  }
}

describe('database migrations', () => {
  it('protects profiles with Supabase ownership and vehicle constraints', () => {
    const profileSql = readMigration('001_profiles.sql')
    const sql = profileSql.toLowerCase()

    expect(sql).toContain('references auth.users(id) on delete cascade')
    expect(profileSql).toMatch(
      /vehicle_type\s+text\s+not null\s+check\s*\(\s*vehicle_type\s+in\s*\('EV',\s*'Petrol',\s*'Hybrid'\)\s*\)/,
    )
    expect(sql).toContain('enable row level security')
    expectOwnerPolicy(profileSql, 'profiles', 'select', 'id', ['using'])
    expectOwnerPolicy(profileSql, 'profiles', 'update', 'id', ['using', 'with check'])
  })

  it('protects favourite locations with ownership and coordinate constraints', () => {
    const favouriteSql = readMigration('002_favourite_locations.sql')
    const sql = favouriteSql.toLowerCase()

    expect(sql).toMatch(/favourite_id\s+serial\s+primary key/)
    expect(sql).toContain('references public.profiles(id) on delete cascade')
    expect(sql).toContain('unique (user_id, latitude, longitude)')
    expect(sql).toMatch(/latitude\s+between\s+-90\s+and\s+90/)
    expect(sql).toMatch(/longitude\s+between\s+-180\s+and\s+180/)
    expect(sql).toContain('enable row level security')
    expectOwnerPolicy(favouriteSql, 'favourite_locations', 'select', 'user_id', ['using'])
    expectOwnerPolicy(favouriteSql, 'favourite_locations', 'insert', 'user_id', ['with check'])
    expectOwnerPolicy(favouriteSql, 'favourite_locations', 'update', 'user_id', [
      'using',
      'with check',
    ])
    expectOwnerPolicy(favouriteSql, 'favourite_locations', 'delete', 'user_id', ['using'])
  })
})
