"""
Support de miroir rotatif style Homme-Lezard (cardan / sphere armillaire).

3 anneaux concentriques + socle pyramide a degres.
  - anneau1 : sertit le miroir (levre devant + jonc colle derriere)
  - anneau2 : pivote dans anneau3 (axe horizontal)
  - anneau1 pivote dans anneau2 (axe perpendiculaire) -> orientation libre
  - anneau3 : fixe, enfiche dans le socle
Les axes sont des tiges metal (laiton/acier) de PIN_D mm, collees dans
l'anneau interieur. Le FREIN (ce qui fait tenir la position) :
  - FREIN = "joint"   : un petit joint torique 2x1 mm (caoutchouc) loge dans
    l'anneau exterieur serre la tige. Le caoutchouc garde sa pression dans le
    temps et le plastique ne subit presque aucun effort -> durable. (defaut)
  - FREIN = "serrage" : trou plus petit que la tige, sans piece en plus.
    Deconseille : le plastique flue (PLA) ou peut fendre (resine).
Les bouts de tige affleurent : une fois peints, ils ressemblent a des rivets.

Usage : python3 support_miroir.py   -> genere les STL + apercu.png
Toutes les cotes sont en mm et modifiables ci-dessous.
"""
import math
import numpy as np
import trimesh
from manifold3d import Manifold, set_circular_segments

set_circular_segments(160)

# ---------------- PARAMETRES ----------------
MIROIR_D = 50.0        # diametre du miroir
MIROIR_EP = 2.0        # epaisseur du miroir  (A CONFIRMER)
JEU_MIROIR = 1.0       # jeu total sur le diametre (0.5 par cote)
LEVRE = 1.7            # largeur de la levre qui recouvre le bord du miroir
EP_LEVRE = 1.0         # epaisseur de la levre avant
EP_JONC = 2.2          # epaisseur du jonc arriere
LARG = 3.5             # largeur radiale de chaque anneau
JEU = 1.0              # jeu entre deux anneaux
PIN_D = 2.0            # diametre des tiges d'axe
FREIN = "joint"        # "joint" (recommande) ou "serrage"
JOINT_DI, JOINT_CS = 2.0, 1.0   # joint torique 2 x 1 mm (diam. interieur x section)
JOINT_COMP = 0.20      # ecrasement du joint (15-25 % = plage normale)
SERRAGE = 0.1          # mode "serrage" : trou = PIN_D - SERRAGE
JEU_TOURNANT = 0.1     # mode "joint"   : trou = PIN_D + JEU_TOURNANT
JEU_COLLE = 0.1        # trou "colle"    = PIN_D + JEU_COLLE
RELIEF = 0.4           # hauteur des motifs en relief
CELL = 0.5             # taille d'un "pixel" de la frise a degres

T = EP_LEVRE + MIROIR_EP + EP_JONC          # epaisseur commune des anneaux
R_SEAT = (MIROIR_D + JEU_MIROIR) / 2
R_LEVRE = MIROIR_D / 2 - LEVRE
R1o = R_SEAT + LARG
R2i, R2o = R1o + JEU, R1o + JEU + LARG
R3i, R3o = R2o + JEU, R2o + JEU + LARG
BOSSE = JEU - 0.2      # rondelles qui centrent l'anneau et ferment le logement du joint
LOGEMENT_D = PIN_D + 2 * JOINT_CS * (1 - JOINT_COMP)   # 3.6 mm pour un joint 2x1
TROU_TOURNANT = PIN_D + JEU_TOURNANT if FREIN == "joint" else PIN_D - SERRAGE
assert T - LOGEMENT_D >= 1.4, "anneaux trop fins pour loger le joint"


def anneau(ri, ro, h, z0=0.0):
    return (Manifold.cylinder(h, ro) - Manifold.cylinder(h + 2, ri).translate([0, 0, -1])).translate([0, 0, z0])


def tige_radiale(r0, r1, d, angle_deg):
    """cylindre radial de r0 a r1, dans le plan median de l'anneau"""
    c = Manifold.cylinder(r1 - r0, d / 2, circular_segments=48).rotate([0, 90, 0]).translate([r0, 0, T / 2])
    return c.rotate([0, 0, angle_deg])


def bosse(r, angle_deg):
    """rondelle de friction collee a l'exterieur d'un anneau (comble le jeu)"""
    d = T  # aussi large que l'anneau est epais -> impression a plat ok
    b = Manifold.cylinder(BOSSE + 0.3, d / 2, circular_segments=48).rotate([0, 90, 0]).translate([r - 0.3, 0, T / 2])
    # bout arrondi (concentrique) -> jeu constant BOSSE..JEU avec l'anneau suivant
    return b.rotate([0, 0, angle_deg]) ^ Manifold.cylinder(T, r + BOSSE)


def pivot_exterieur(ri, ro, angle_deg):
    """trou ou la tige TOURNE (+ logement du joint torique cote interieur)"""
    m = tige_radiale(ri - 2, ro + 3, TROU_TOURNANT, angle_deg)
    if FREIN == "joint":
        m += tige_radiale(ri - 2, ri + JOINT_CS + 0.1, LOGEMENT_D, angle_deg)
    return m


def frise(ri, ro, z0):
    """frise a degres (grecque meso-americaine) en relief sur la face avant.
    Construite en 2D (union robuste) puis extrudee."""
    from manifold3d import CrossSection, OpType
    bord = CELL
    polys = [CrossSection.circle(ro - 0.03, 160) - CrossSection.circle(ro - bord, 160),
             CrossSection.circle(ri + bord, 160) - CrossSection.circle(ri + 0.03, 160)]
    n_rows = int(round((ro - ri - 2 * bord) / CELL))
    if n_rows >= 3:
        rows = n_rows - 1
        motif = list(range(rows)) + [rows - 1] + list(range(rows - 1, -1, -1)) + [0]
        circ = 2 * math.pi * (ri + ro) / 2
        n_per = max(1, int(circ // (len(motif) * CELL)))
        da = 2 * math.pi / (n_per * len(motif))
        y_base = ri + bord
        for p in range(n_per):
            for i, h in enumerate(motif):
                k = p * len(motif) + i
                h1 = min(h + 2, n_rows)
                r_lo = y_base + h * CELL - (0.05 if h == 0 else 0)
                r_hi = y_base + h1 * CELL + (0.05 if h1 == n_rows else 0)
                a0, a1 = (k - 0.02) * da, (k + 1.02) * da
                arc = [a0 + (a1 - a0) * t / 3 for t in range(4)]
                pts = [(r_lo * math.cos(a), r_lo * math.sin(a)) for a in arc] + \
                      [(r_hi * math.cos(a), r_hi * math.sin(a)) for a in reversed(arc)]
                polys.append(CrossSection([pts[::-1]]))  # sens anti-horaire
    cs = CrossSection.batch_boolean(polys, OpType.Add)
    return Manifold.extrude(cs, RELIEF + 0.05).translate([0, 0, z0 - 0.05])


def rayons(r, n, longueur, larg, exclure_deg, marge_deg=12):
    """rayons du disque solaire autour de l'anneau exterieur"""
    out = []
    for i in range(n):
        a = 360 * i / n
        if any(abs(((a - e + 180) % 360) - 180) < marge_deg for e in exclure_deg):
            continue
        b = Manifold.hull_points([
            [r - 0.5, -larg / 2, 0], [r - 0.5, larg / 2, 0], [r - 0.5, -larg / 2, T], [r - 0.5, larg / 2, T],
            [r + longueur, -larg / 4, 0.6], [r + longueur, larg / 4, 0.6],
            [r + longueur, -larg / 4, T - 0.6], [r + longueur, larg / 4, T - 0.6]])
        out.append(b.rotate([0, 0, a]))
    return out


# ---------------- PIECES (orientees pour l'impression, a plat) ----------------
def make_anneau1():
    """levre avant posee sur le plateau (z=0 = face avant)"""
    corps = anneau(R_LEVRE, R1o, EP_LEVRE) + anneau(R_SEAT, R1o, T)
    for a in (90, 270):
        corps += bosse(R1o, a)
        corps -= tige_radiale(R_SEAT + 0.6, R1o + 2, PIN_D + JEU_COLLE, a)
    return corps


def make_jonc():
    return anneau(R_LEVRE, R_SEAT - 0.15, EP_JONC)


def make_anneau2():
    corps = anneau(R2i, R2o, T) + frise(R2i, R2o, T)
    for a in (0, 180):                      # axe vers anneau3 : tige collee ici
        corps += bosse(R2o, a)
        corps -= tige_radiale(R2i + 0.8, R2o + 2, PIN_D + JEU_COLLE, a)
    for a in (90, 270):                     # axe vers anneau1 : la tige tourne ici
        corps -= pivot_exterieur(R2i, R2o, a)
    return corps


TENON = (6.0, 5.0)  # largeur, longueur du tenon sous l'anneau3


def make_anneau3():
    corps = anneau(R3i, R3o, T) + frise(R3i, R3o, T)
    corps += Manifold.batch_boolean(rayons(R3o, 36, 1.6, 2.0, [0, 180, 270]), __import__("manifold3d").OpType.Add)
    tenon = Manifold.cube([TENON[0], TENON[1] + 1.5, T]).translate([-TENON[0] / 2, -R3o - TENON[1], 0])
    corps += tenon
    for a in (0, 180):
        corps -= pivot_exterieur(R3i, R3o, a)
    return corps


def make_socle():
    """pyramide a degres ; le haut du fut est a z=0 local, origine sous le centre"""
    marches = [(66, 54), (56, 45), (46, 36), (36, 27)]
    h = 3.5
    fut_h = 5.0
    z = 0.0
    s = None
    for (lx, ly) in marches:
        b = Manifold.cube([lx, ly, h]).translate([-lx / 2, -ly / 2, z])
        s = b if s is None else s + b
        z += h
    top_pyr = z
    # petit temple / fut
    fut = Manifold.cube([14, 10, fut_h]).translate([-7, -5, z])
    corniche = Manifold.cube([16, 12, 1.2]).translate([-8, -6, z + fut_h - 1.2])
    s += fut + corniche
    # escalier central sur la face avant (-Y)
    n = 10
    y0, y1 = -marches[0][1] / 2 - 2.5, -marches[-1][1] / 2
    for j in range(n):
        zt = (j + 1) * top_pyr / n
        yf = y0 + j * (y1 - y0) / n
        s += Manifold.cube([8, -yf, zt]).translate([-4, yf, 0])
    for sx in (-1, 1):  # rampes laterales
        s += Manifold.hull_points([[sx * 4, y0, 0], [sx * 5.2, y0, 0], [sx * 4, y0, 1.5], [sx * 5.2, y0, 1.5],
                                   [sx * 4, y1, top_pyr + 0.6], [sx * 5.2, y1, top_pyr + 0.6],
                                   [sx * 4, y1 + 1, 0], [sx * 5.2, y1 + 1, 0]])
    # mortaise pour le tenon
    zt = top_pyr + fut_h
    mort = Manifold.cube([TENON[0] + 0.3, T + 0.3, TENON[1] + 0.3]).translate(
        [-(TENON[0] + 0.3) / 2, -(T + 0.3) / 2, zt - TENON[1] - 0.3])
    # logement de lest sous le socle (plombs de peche, rondelles acier...)
    lest = Manifold.cube([LEST[0], LEST[1], LEST[2] + 1]).translate([-LEST[0] / 2, -LEST[1] / 2 + 2, -1])
    return s - mort - lest, zt


LEST = (44.0, 30.0, 6.0)  # cavite sous le socle (L x l x h)


# ---------------- EXPORT ----------------
def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts))


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    a1, jonc, a2, a3 = make_anneau1(), make_jonc(), make_anneau2(), make_anneau3()
    socle, z_top = make_socle()
    pieces = {"1_anneau_miroir": a1, "1b_jonc_arriere": jonc, "2_anneau_milieu": a2,
              "3_anneau_exterieur": a3, "4_socle_pyramide": socle}
    for name, m in pieces.items():
        tm = to_trimesh(m)
        assert tm.is_watertight, name
        tm.export(os.path.join(here, f"{name}.stl"))
        e = tm.extents
        print(f"{name:22s} {e[0]:6.1f} x {e[1]:6.1f} x {e[2]:5.1f} mm  watertight={tm.is_watertight}")

    print(f"\nEpaisseur anneaux T={T}  | diametre exterieur ~{2 * (R3o + 1.6):.1f} mm")
    print(f"Tige anneau1<->2 : longueur {R2o - (R_SEAT + 0.6):.1f} mm | anneau2<->3 : {R3o - (R2i + 0.8):.1f} mm")

    # ------- assemblage pour l'apercu (plan du miroir = XZ, face avant vers -Y)
    def pose(m):  # local XY (z=0 face avant ou arriere) -> monde XZ centre
        return m.translate([0, 0, -T / 2]).rotate([90, 0, 0])

    tilt2, pan1 = 25, 40
    A1 = pose(a1.mirror([0, 0, 1]).translate([0, 0, T]))  # face avant vers -Y
    J = pose(jonc.translate([0, 0, EP_LEVRE + MIROIR_EP]).mirror([0, 0, 1]).translate([0, 0, T]))
    mir = pose(Manifold.cylinder(MIROIR_EP, MIROIR_D / 2).translate([0, 0, EP_LEVRE]).mirror([0, 0, 1]).translate([0, 0, T]))
    A2, A3 = pose(a2), pose(a3)
    # anneau1 pivote autour de son axe (local Y -> monde Z) ; anneau2 autour de X
    g1 = (A1 + J).rotate([0, 0, pan1]).rotate([tilt2, 0, 0])
    gm = mir.rotate([0, 0, pan1]).rotate([tilt2, 0, 0])
    g2 = A2.rotate([tilt2, 0, 0])
    S = socle.translate([0, 0, -z_top - R3o])
    frame = g1 + g2 + A3 + S
    assert frame.min_gap(gm, 0.01) >= 0 if hasattr(frame, "min_gap") else True

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    def draw(ax, m, color):
        tm = to_trimesh(m)
        tris = tm.vertices[tm.faces]
        n = tm.face_normals
        light = np.array([-0.4, -0.8, 0.6]); light /= np.linalg.norm(light)
        sh = np.clip(n @ light, 0, 1) * 0.75 + 0.25
        base = np.array(matplotlib.colors.to_rgb(color))
        pc = Poly3DCollection(tris, facecolors=np.outer(sh, base), linewidths=0)
        ax.add_collection3d(pc)

    fig = plt.figure(figsize=(14, 7), dpi=110)
    for k, (el, az, title) in enumerate([(12, -70, "3/4 avant"), (5, -90, "face"), (60, -30, "dessus")]):
        ax = fig.add_subplot(1, 3, k + 1, projection="3d")
        draw(ax, frame, "#c9a227")
        draw(ax, gm, "#9fc6e8")
        lim = 48
        ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.set_zlim(-lim - 18, lim - 18)
        ax.set_box_aspect((1, 1, 1)); ax.view_init(el, az); ax.set_axis_off(); ax.set_title(title)
    plt.tight_layout()
    plt.savefig(os.path.join(here, "apercu.png"))

    # gros plan sur la frise
    fig = plt.figure(figsize=(7, 7), dpi=110)
    ax = fig.add_subplot(projection="3d")
    draw(ax, a3 + a2, "#c9a227")
    ax.set_xlim(10, 45); ax.set_ylim(10, 45); ax.set_zlim(-15, 20)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(55, 35); ax.set_axis_off()
    plt.savefig(os.path.join(here, "apercu_detail.png"))
    print("apercus ok")
