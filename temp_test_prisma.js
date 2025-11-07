const { PrismaClient, AppointmentStatus } = require('./src/generated/prisma');
(async () => {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.appointment.count({
      where: {
        patientId: '690394645ce26c4f23a0e240',
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
        startAt: { gt: new Date() }
      }
    });
    console.log('count', count);
  } catch (e) {
    console.error('ERROR', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
