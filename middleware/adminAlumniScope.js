const adminAlumniScope = (req, res, next) => {
  if (req.user?.role === "superadmin") {
    req.adminDepartment = null;
    return next();
  }

  const department = req.user?.department;
  if (typeof department !== "string" || !department.trim()) {
    return res.status(403).json({
      message: "Admin department is not configured",
    });
  }

  req.adminDepartment = department.trim();
  return next();
};

module.exports = adminAlumniScope;
