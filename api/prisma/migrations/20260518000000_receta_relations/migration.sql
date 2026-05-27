-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_evolucion_id_fkey" FOREIGN KEY ("evolucion_id") REFERENCES "EvolucionClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

