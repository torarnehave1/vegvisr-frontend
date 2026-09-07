// Cloudflare Worker for Sanskrit Learner API
// Place this in: worker/worker.js

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email, x-user-id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Get Sanskrit letters
      if (url.pathname === '/api/sanskrit/letters' && request.method === 'GET') {
        const category = url.searchParams.get('category'); // vowel, consonant, or null for all
        const difficulty = url.searchParams.get('difficulty');

        let query = 'SELECT * FROM sanskrit_letters WHERE 1=1';
        const params = [];

        if (category) {
          query += ' AND category = ?';
          params.push(category);
        }

        if (difficulty) {
          query += ' AND difficulty_level = ?';
          params.push(parseInt(difficulty));
        }

        query += ' ORDER BY difficulty_level, id';

        const { results } = await env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify({ letters: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user progress
      if (url.pathname === '/api/sanskrit/progress' && request.method === 'GET') {
        const userId = url.searchParams.get('userId') || 'default';

        const { results } = await env.DB.prepare(
          `SELECT p.*, l.devanagari, l.romanization, l.category 
           FROM sanskrit_user_progress p
           JOIN sanskrit_letters l ON p.letter_id = l.id
           WHERE p.user_id = ?
           ORDER BY p.last_practiced DESC`
        )
          .bind(userId)
          .all();

        return new Response(JSON.stringify({ progress: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update progress
      if (url.pathname === '/api/sanskrit/progress' && request.method === 'POST') {
        const data = await request.json();
        const { userId = 'default', letterId, correct, mode } = data;

        // Check if progress exists
        const existing = await env.DB.prepare(
          'SELECT * FROM sanskrit_user_progress WHERE user_id = ? AND letter_id = ?'
        )
          .bind(userId, letterId)
          .first();

        if (existing) {
          // Update existing progress
          const newCorrect = existing.correct_count + (correct ? 1 : 0);
          const newTotal = existing.total_attempts + 1;
          const accuracy = newCorrect / newTotal;
          const newMastery = Math.min(5, Math.floor(accuracy * 5));

          await env.DB.prepare(
            `UPDATE sanskrit_user_progress 
             SET mastery_level = ?, times_practiced = times_practiced + 1,
                 correct_count = ?, total_attempts = ?, last_practiced = CURRENT_TIMESTAMP
             WHERE user_id = ? AND letter_id = ?`
          )
            .bind(newMastery, newCorrect, newTotal, userId, letterId)
            .run();
        } else {
          // Insert new progress
          await env.DB.prepare(
            `INSERT INTO sanskrit_user_progress 
             (user_id, letter_id, mastery_level, times_practiced, correct_count, total_attempts, last_practiced)
             VALUES (?, ?, ?, 1, ?, 1, CURRENT_TIMESTAMP)`
          )
            .bind(userId, letterId, correct ? 1 : 0, correct ? 1 : 0)
            .run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Start practice session
      if (url.pathname === '/api/sanskrit/session' && request.method === 'POST') {
        const data = await request.json();
        const { userId = 'default', mode } = data;

        const result = await env.DB.prepare(
          `INSERT INTO sanskrit_practice_sessions (user_id, mode)
           VALUES (?, ?) RETURNING id`
        )
          .bind(userId, mode)
          .first();

        return new Response(JSON.stringify({ sessionId: result.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // End practice session
      if (url.pathname === '/api/sanskrit/session' && request.method === 'PUT') {
        const data = await request.json();
        const { sessionId, score, totalQuestions, duration } = data;

        await env.DB.prepare(
          `UPDATE sanskrit_practice_sessions 
           SET score = ?, total_questions = ?, duration_seconds = ?, ended_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
          .bind(score, totalQuestions, duration, sessionId)
          .run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get achievements
      if (url.pathname === '/api/sanskrit/achievements' && request.method === 'GET') {
        const userId = url.searchParams.get('userId') || 'default';

        const { results } = await env.DB.prepare(
          'SELECT * FROM sanskrit_achievements WHERE user_id = ? ORDER BY unlocked_at DESC'
        )
          .bind(userId)
          .all();

        return new Response(JSON.stringify({ achievements: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Unlock achievement
      if (url.pathname === '/api/sanskrit/achievements' && request.method === 'POST') {
        const data = await request.json();
        const { userId = 'default', achievementType } = data;

        // Check if already unlocked
        const existing = await env.DB.prepare(
          'SELECT * FROM sanskrit_achievements WHERE user_id = ? AND achievement_type = ?'
        )
          .bind(userId, achievementType)
          .first();

        if (!existing) {
          await env.DB.prepare(
            'INSERT INTO sanskrit_achievements (user_id, achievement_type) VALUES (?, ?)'
          )
            .bind(userId, achievementType)
            .run();

          return new Response(JSON.stringify({ unlocked: true, achievementType }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ unlocked: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
