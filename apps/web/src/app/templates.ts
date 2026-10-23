import { parseCompany, type CompanyDef } from '@office-pixel/sim';
import banco from '../../../../examples/banco_pixel.yaml?raw';
import ferreteria from '../../../../examples/plantilla_pequena_ferreteria.yaml?raw';
import distribuidora from '../../../../examples/plantilla_mediana_distribuidora.yaml?raw';
import centro from '../../../../examples/plantilla_grande_centro_distribucion.yaml?raw';

export interface Template {
  id: string;
  label: string;
  description: string;
  make: () => CompanyDef;
}

const from = (text: string) => () => parseCompany(text).def!;

/** Empresas de ejemplo para empezar: de pequeñas a grandes. */
export const TEMPLATES: Template[] = [
  {
    id: 'banco',
    label: 'Banco Pixel (servicios, 32 personas)',
    description: 'Oficinas: crédito, riesgos, legal y atención',
    make: from(banco),
  },
  {
    id: 'ferreteria',
    label: 'Ferretería El Tornillo (pequeña, 10 personas)',
    description: 'Tienda, bodega, recepción, despacho, guardia y mantenimiento',
    make: from(ferreteria),
  },
  {
    id: 'distribuidora',
    label: 'Distribuidora Andina (mediana, 38 personas)',
    description: 'Logística con bodegas, picking, flota, seguridad y mantenimiento',
    make: from(distribuidora),
  },
  {
    id: 'centro',
    label: 'Centro de Distribución Pacífico (grande, 60+ personas)',
    description: 'Recepción, cadena de frío, despacho, transporte, seguridad y mantenimiento',
    make: from(centro),
  },
];
