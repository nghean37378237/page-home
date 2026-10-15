import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fetchWpStatsDashboard, fetchWpLivePanelOnly } from './src/server/wpStatsService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route: Lấy dữ liệu bảng thống kê trực tiếp từ WordPress celeb24h.com
  app.get('/api/wp-stats', async (req, res) => {
    try {
      const mode = String(req.query.mode || 'dashboard');
      if (mode === 'live') {
        const liveEmployee = String(req.query.live_employee || '');
        const scope = String(req.query.scope || '');
        const realtime = await fetchWpLivePanelOnly(liveEmployee, scope);
        res.json({ ok: true, realtime });
        return;
      }

      const rawScope = String(req.query.scope || '');
      const validScope: 'site' | 'mine' | 'employee' | undefined =
        rawScope === 'site' || rawScope === 'mine' || rawScope === 'employee'
          ? rawScope
          : undefined;

      const payload = await fetchWpStatsDashboard({
        range: req.query.range ? String(req.query.range) : '7',
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        scope: validScope,
        employee: req.query.employee ? String(req.query.employee) : '',
        viewerEmployeeCode: req.query.viewer_employee ? String(req.query.viewer_employee) : '',
        liveEmployee:
          req.query.live_employee !== undefined ? String(req.query.live_employee) : undefined,
        topRange: req.query.top_range ? String(req.query.top_range) : '7',
        topFrom: req.query.top_from ? String(req.query.top_from) : undefined,
        topTo: req.query.top_to ? String(req.query.top_to) : undefined,
        empDays: req.query.emp_days ? String(req.query.emp_days) : '7',
        empDetailCode: req.query.emp_detail ? String(req.query.emp_detail) : undefined,
        staffTopPeriod: req.query.staff_top_period ? String(req.query.staff_top_period) : '7',
      });

      res.json(payload);
    } catch (error: any) {
      console.error('[/api/wp-stats] Error:', error);
      res.status(500).json({
        ok: false,
        error: error?.message || 'Không thể lấy dữ liệu thống kê từ celeb24h.com',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
