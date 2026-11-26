"""Verifications mecaniques du support de miroir (collisions, couples, stabilite)."""
import math
import numpy as np
from manifold3d import Manifold
import support_miroir as s

G = 9.81
RHO_PLA, RHO_VERRE = 1.24e-3, 2.5e-3   # g/mm3
T = s.T


def pose(m):  # local (anneau dans XY) -> monde (anneau dans XZ, centre a l'origine)
    return m.translate([0, 0, -T / 2]).rotate([90, 0, 0])


a1 = pose(s.make_anneau1().mirror([0, 0, 1]).translate([0, 0, T]))
jonc = pose(s.make_jonc().translate([0, 0, s.EP_LEVRE + s.MIROIR_EP]).mirror([0, 0, 1]).translate([0, 0, T]))
mir = pose(Manifold.cylinder(s.MIROIR_EP, s.MIROIR_D / 2).translate([0, 0, s.EP_LEVRE]).mirror([0, 0, 1]).translate([0, 0, T]))
a2, a3 = pose(s.make_anneau2()), pose(s.make_anneau3())
socle, z_top = s.make_socle()
socle = socle.translate([0, 0, -z_top - s.R3o])

print("=== 1. Collisions sur tout le debattement ===")
# axe anneau1/anneau2 = Z monde ; axe anneau2/anneau3 = X monde
pire12 = max((a1 + jonc).rotate([0, 0, ang]).__xor__(a2).volume() for ang in range(0, 360, 3))
pire23 = max(a2.rotate([ang, 0, 0]).__xor__(a3).volume() for ang in range(0, 360, 3))
pire2s = max(a2.rotate([ang, 0, 0]).__xor__(socle).volume() for ang in range(0, 360, 3))
pire1s = max((a1 + jonc).rotate([0, 0, p]).rotate([t, 0, 0]).__xor__(a3 + socle).volume()
             for p in range(0, 360, 15) for t in range(0, 360, 15))
print(f"anneau1 dans anneau2 (tour complet, pas 3deg) : volume de collision max = {pire12:.4f} mm3")
print(f"anneau2 dans anneau3 (tour complet, pas 3deg) : {pire23:.4f} mm3 ; contre le socle : {pire2s:.4f} mm3")
print(f"anneau1 (toutes combinaisons, pas 15deg) contre anneau3/socle : {pire1s:.4f} mm3")
gap12 = min(a1.rotate([0, 0, ang]).min_gap(a2, 3) for ang in range(5, 180, 5))
gap23 = min(a2.rotate([ang, 0, 0]).min_gap(a3, 3) for ang in range(5, 180, 5))
print(f"jeu mini hors pivots : anneau1/2 = {gap12:.2f} mm ; anneau2/3 = {gap23:.2f} mm")


def props(m, rho):
    tm = s.to_trimesh(m)
    return tm.volume * rho, tm.center_mass


print("\n=== 2. Masses et desequilibre (ce que le frein doit retenir) ===")
m_mir, c_mir = props(mir, RHO_VERRE)
m_a1, c_a1 = props(a1 + jonc, RHO_PLA)
m_a2, c_a2 = props(a2, RHO_PLA)
m_a3, c_a3 = props(a3, RHO_PLA)
m_so, c_so = props(socle, RHO_PLA)
print(f"miroir {m_mir:.1f} g | anneau1+jonc {m_a1:.1f} g | anneau2 {m_a2:.1f} g | anneau3 {m_a3:.1f} g | socle {m_so:.1f} g")
# pire cas : miroir decale de tout son jeu (0.5 mm) + decalage en epaisseur
dec_radial = s.JEU_MIROIR / 2
m_g1 = m_mir + m_a1
c_g1 = (m_mir * c_mir + m_a1 * c_a1) / m_g1
d1 = math.hypot(np.linalg.norm(c_g1[[0, 1]]), 0) + m_mir / m_g1 * dec_radial
C1 = m_g1 / 1000 * G * d1          # N.mm
m_g2 = m_g1 + m_a2
d2 = (m_g1 * d1 + m_a2 * np.linalg.norm(c_a2[[1, 2]])) / m_g2
C2 = m_g2 / 1000 * G * d2
print(f"axe 1 (miroir) : masse {m_g1:.1f} g, centre de gravite a {d1:.2f} mm de l'axe au pire -> couple {C1:.3f} N.mm")
print(f"axe 2          : masse {m_g2:.1f} g, decalage {d2:.2f} mm au pire -> couple {C2:.3f} N.mm")
print("  (le cardan est equilibre : le centre de gravite est quasiment SUR les axes)")

print("\n=== 3. Stabilite au sol ===")
m_tot = m_g2 + m_a3 + m_so
c_tot = (m_g1 * c_g1 + m_a2 * c_a2 + m_a3 * c_a3 + m_so * c_so) / m_tot
zmin = s.to_trimesh(socle).bounds[0][2]
h = c_tot[2] - zmin
for axe, demi in (("avant/arriere", 54 / 2), ("cote", 66 / 2)):
    ang = math.degrees(math.atan(demi / h))
    print(f"bascule {axe:13s}: centre de gravite a {h:.0f} mm du sol, demi-base {demi:.0f} mm -> se renverse au-dela de {ang:.0f} deg d'inclinaison")
h_haut = s.R3o + (-zmin - s.R3o) + s.R3o
F_renverse = m_tot / 1000 * G * 27 / h_haut
print(f"poids total {m_tot:.0f} g ; force pour le renverser en poussant le haut de l'anneau : {F_renverse:.2f} N (~{F_renverse / G * 1000:.0f} g)")

print("\n=== 4. Le miroir peut-il sortir ? ===")
rec_min = s.MIROIR_D / 2 - s.JEU_MIROIR / 2 - s.R_LEVRE
print(f"recouvrement de la levre au pire (miroir decale) : {rec_min:.2f} mm ; jonc arriere colle sur {s.R_SEAT - 0.15 - s.R_LEVRE:.2f} mm de large")

print("\n=== 5. Le frein (joint torique 2x1 mm) ===")
circ = math.pi * s.PIN_D                       # contact joint / tige
# hypotheses : 0.2 a 0.6 N par mm de circonference a ~20 % d'ecrasement (NBR 70 Shore A,
# section 1 mm) ; coefficient de frottement caoutchouc/metal 0.3 (graisse) a 0.6 (sec)
Cmin = 0.3 * 0.2 * circ * s.PIN_D / 2
Cmax = 0.6 * 0.6 * circ * s.PIN_D / 2
Cg = max(C1, C2)
print(f"couple de freinage estime par pivot : {Cmin:.2f} a {Cmax:.2f} N.mm (x2 pivots par axe)")
print(f"couple de la gravite au pire : {Cg:.3f} N.mm -> marge x{2 * Cmin / Cg:.0f} a x{2 * Cmax / Cg:.0f}")
print(f"force au doigt pour tourner (sur l'anneau, r~30 mm) : {2 * Cmin / 30 * 1000 / G:.0f} a {2 * Cmax / 30 * 1000 / G:.0f} g-force")
print(f"paroi autour du logement du joint : {(s.T - s.LOGEMENT_D) / 2:.2f} mm de chaque cote")
print(f"comparaison mode 'serrage' : tige {s.PIN_D} dans trou {s.PIN_D - s.SERRAGE} -> deformation imposee "
      f"{s.SERRAGE / s.PIN_D * 100:.0f} % (PLA plastifie vers 2-3 %, resine standard casse vers 2-6 %)")

print("\n=== 6. Avec lest dans le socle ===")
vol = s.LEST[0] * s.LEST[1] * s.LEST[2] / 1000
for nom, dens in (("plombs de peche", 6.0), ("rondelles/billes acier", 4.0)):
    ml = vol * dens
    mt = m_tot + ml
    ht = (m_tot * h + ml * s.LEST[2] / 2) / mt
    F = mt / 1000 * G * 27 / h_haut
    print(f"{nom:22s}: +{ml:.0f} g -> centre de gravite a {ht:.0f} mm, bascule a {math.degrees(math.atan(27 / ht)):.0f} deg, "
          f"force de renversement {F * 1000 / G:.0f} g-force")
