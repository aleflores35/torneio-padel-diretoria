const supabase = require('../supabase');

const authMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    // Buscar perfil para verificar role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (allowedRoles.length > 0 && !allowedRoles.includes(profile.role))) {
      return res.status(403).json({ error: "Acesso negado: Permissão insuficiente" });
    }

    req.user = user;
    req.role = profile.role;
    next();
  };
};

module.exports = authMiddleware;
