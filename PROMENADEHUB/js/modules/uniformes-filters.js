const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function isDateRangeValid({ startDate = '', endDate = '' } = {}) {
  return !startDate || !endDate || startDate <= endDate;
}

/** Filtros de consulta locais; não alteram registros nem determinam regras do ciclo. */
export function filterLoans(loans, filters = {}) {
  if (!isDateRangeValid(filters)) return [];
  const query = normalize(filters.query);
  return loans.filter((loan) => {
    const employee = loan.employee ?? {};
    const matchesQuery = !query || [employee.name, employee.registration]
      .some((value) => normalize(value).includes(query));
    const matchesStatus = !filters.status || loan.status === filters.status;
    const matchesUniform = !filters.uniform || (loan.items ?? [])
      .some((item) => item.uniform === filters.uniform);
    // O filtro usa a data civil do empréstimo, sem conversões de fuso horário.
    const date = String(loan.loanDate ?? '').slice(0, 10);
    const matchesStart = !filters.startDate || (date && date >= filters.startDate);
    const matchesEnd = !filters.endDate || (date && date <= filters.endDate);
    return matchesQuery && matchesStatus && matchesUniform && matchesStart && matchesEnd;
  });
}
