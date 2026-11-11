const PRIMARY_KEYS = Object.freeze({
  users: 'id',
  profiles: 'user_id',
  rooms: 'room_id',
  room_requests: 'request_id',
  registration_otps: 'id',
  password_reset_otps: 'id',
  notifications: 'id',
  chat_messages: 'id',
  room_views: 'id',
  room_images: 'id',
  activity_events: 'id'
});

const MYSQL_TO_POSTGRES_ERRORS = Object.freeze({
  '23505': 'ER_DUP_ENTRY',
  '42P01': 'ER_NO_SUCH_TABLE',
  '42703': 'ER_BAD_FIELD_ERROR',
  '28P01': 'ER_ACCESS_DENIED_ERROR'
});

const FORMAT_TOKENS = Object.freeze({
  '%Y': 'YYYY',
  '%y': 'YY',
  '%m': 'MM',
  '%d': 'DD',
  '%H': 'HH24',
  '%h': 'HH12',
  '%i': 'MI',
  '%s': 'SS',
  '%M': 'Month',
  '%b': 'Mon',
  '%W': 'Day',
  '%a': 'Dy'
});

const convertDateFormat = (format) => Object.entries(FORMAT_TOKENS)
  .sort(([a], [b]) => b.length - a.length)
  .reduce((value, [mysqlToken, postgresToken]) => value.split(mysqlToken).join(postgresToken), format);

const replaceIfFunctions = (sql) => {
  let output = '';
  let index = 0;
  let quote = null;

  while (index < sql.length) {
    const char = sql[index];

    if (quote) {
      output += char;
      if (char === quote) {
        if (sql[index + 1] === quote) {
          output += sql[index + 1];
          index += 2;
          continue;
        }
        quote = null;
      } else if (char === '\\\\' && quote === "'" && index + 1 < sql.length) {
        output += sql[index + 1];
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      index += 1;
      continue;
    }

    const match = sql.slice(index).match(/^IF\\s*\\(/i);
    if (!match) {
      output += char;
      index += 1;
      continue;
    }

    const openIndex = index + match[0].lastIndexOf('(');
    let cursor = openIndex + 1;
    let depth = 1;
    let innerQuote = null;
    const args = [];
    let argStart = cursor;

    while (cursor < sql.length && depth > 0) {
      const current = sql[cursor];

      if (innerQuote) {
        if (current === innerQuote) {
          if (sql[cursor + 1] === innerQuote) {
            cursor += 2;
            continue;
          }
          innerQuote = null;
        } else if (current === '\\\\' && innerQuote === "'" && cursor + 1 < sql.length) {
          cursor += 2;
          continue;
        }
      } else if (current === "'" || current === '"') {
        innerQuote = current;
      } else if (current === '(') {
        depth += 1;
      } else if (current === ')') {
        depth -= 1;
        if (depth === 0) {
          args.push(sql.slice(argStart, cursor).trim());
          break;
        }
      } else if (current === ',' && depth === 1) {
        args.push(sql.slice(argStart, cursor).trim());
        argStart = cursor + 1;
      }

      cursor += 1;
    }

    if (depth !== 0 || args.length !== 3) {
      output += char;
      index += 1;
      continue;
    }

    output += `(CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END)`;
    index = cursor + 1;
  }

  return output;
};

const replaceQuestionPlaceholders = (sql) => {
  let output = '';
  let placeholder = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      output += char;
      if (char === '\\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      output += char;
      if (char === '*' && next === '/') {
        output += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      output += char;
      if (char === quote) {
        if (next === quote) {
          output += next;
          index += 1;
        } else {
          quote = null;
        }
      } else if (char === '\\\\' && quote === "'" && next) {
        output += next;
        index += 1;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      output += char + next;
      index += 1;
      lineComment = true;
      continue;
    }
    if (char === '/' && next === '*') {
      output += char + next;
      index += 1;
      blockComment = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      continue;
    }
    if (char === '?') {
      placeholder += 1;
      output += `$${placeholder}`;
      continue;
    }

    output += char;
  }

  return output;
};

const translateMySqlSql = (input) => {
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('A non-empty SQL statement is required.');
  }

  let sql = input.trim().replace(/;\\s*$/, '');

  const showColumns = sql.match(/^SHOW\\s+COLUMNS\\s+FROM\\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
  if (showColumns) {
    const tableName = showColumns[1].toLowerCase();
    return `SELECT column_name AS "Field", data_type AS "Type", is_nullable AS "Null", column_default AS "Default" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${tableName}' ORDER BY ordinal_position`;
  }

  sql = sql.replace(
    /DATE_SUB\\s*\\(\\s*NOW\\(\\)\\s*,\\s*INTERVAL\\s+(\\d+)\\s+(DAY|HOUR|MINUTE|SECOND)\\s*\\)/gi,
    (_match, amount, unit) => `(CURRENT_TIMESTAMP - INTERVAL '${amount} ${unit.toLowerCase()}')`
  );
  sql = sql.replace(
    /DATE_ADD\\s*\\(\\s*NOW\\(\\)\\s*,\\s*INTERVAL\\s+(\\d+)\\s+(DAY|HOUR|MINUTE|SECOND)\\s*\\)/gi,
    (_match, amount, unit) => `(CURRENT_TIMESTAMP + INTERVAL '${amount} ${unit.toLowerCase()}')`
  );
  sql = sql.replace(
    /\\bINTERVAL\\s+(\\d+)\\s+(DAY|HOUR|MINUTE|SECOND)\\b/gi,
    (_match, amount, unit) => `INTERVAL '${amount} ${unit.toLowerCase()}'`
  );
  sql = sql.replace(
    /DATE_FORMAT\\s*\\(\\s*([^,()]+?)\\s*,\\s*'([^']+)'\\s*\\)/gi,
    (_match, expression, format) => `TO_CHAR(${expression.trim()}, '${convertDateFormat(format)}')`
  );
  sql = sql.replace(
    /SUBSTRING_INDEX\\s*\\(\\s*([a-zA-Z_][a-zA-Z0-9_.]*)\\s*,\\s*(['"])(.*?)\\2\\s*,\\s*1\\s*\\)/gi,
    (_match, expression, _quote, delimiter) => `SPLIT_PART(${expression}, '${delimiter.replace(/'/g, "''")}', 1)`
  );
  sql = sql.replace(
    /ON\\s+DUPLICATE\\s+KEY\\s+UPDATE\\s+view_count\\s*=\\s*view_count\\s*\\+\\s*1\\s*,\\s*last_viewed_at\\s*=\\s*CURRENT_TIMESTAMP/gi,
    'ON CONFLICT (room_id, viewer_id) DO UPDATE SET view_count = room_views.view_count + 1, last_viewed_at = CURRENT_TIMESTAMP'
  );

  sql = replaceIfFunctions(sql);
  sql = sql.replace(
    /\\bSUM\\s*\\(\\s*([^()]*?(?:>=|<=|<>|!=|=|>|<)[^()]*)\\s*\\)/gi,
    (_match, expression) => `COUNT(*) FILTER (WHERE ${expression.trim()})`
  );

  return replaceQuestionPlaceholders(sql);
};

const getInsertPrimaryKey = (sql) => {
  const match = sql.match(/^\\s*INSERT\\s+INTO\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (!match) return null;
  return PRIMARY_KEYS[match[1].toLowerCase()] || null;
};

const addReturningClause = (sql) => {
  if (!/^\\s*INSERT\\b/i.test(sql) || /\\bRETURNING\\b/i.test(sql)) return { sql, primaryKey: null };
  const primaryKey = getInsertPrimaryKey(sql);
  if (!primaryKey) return { sql, primaryKey: null };
  return { sql: `${sql} RETURNING ${primaryKey}`, primaryKey };
};

const normalizePostgresError = (error) => {
  if (!error || typeof error !== 'object') return error;
  const postgresCode = error.code;
  if (postgresCode && MYSQL_TO_POSTGRES_ERRORS[postgresCode]) {
    error.postgresCode = postgresCode;
    error.code = MYSQL_TO_POSTGRES_ERRORS[postgresCode];
    if (postgresCode === '42P01') error.errno = 1146;
  }
  return error;
};

module.exports = {
  addReturningClause,
  getInsertPrimaryKey,
  normalizePostgresError,
  replaceQuestionPlaceholders,
  translateMySqlSql
};
