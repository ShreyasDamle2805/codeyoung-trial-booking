import React from "react";
import { Code2, Sparkles, Video, Clock3, Heart } from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Codeyoung home">
      <span className="brand-mark">
        <Code2 size={24} />
      </span>
      code<span>young</span>
      <span className="brand-dot">.</span>
    </a>
  );
}

export function Intro() {
  return (
    <aside className="intro">
      <span className="eyebrow">
        <span /> BIG IDEAS START SMALL
      </span>
      <h1>
        A spark today.
        <br />A brighter <span>tomorrow.</span>
      </h1>
      <p className="intro-copy">
        Discover what your child can do with a mentor who brings learning to
        life.
      </p>
      <div className="lesson-art" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <span className="floating-star">✦</span>
        <div className="code-window">
          <div className="window-bar">
            <i />
            <i />
            <i />
            <span>my_first_adventure</span>
          </div>
          <div className="code-lines">
            <span className="purple">when</span> curiosity{" "}
            <span className="purple">begins:</span>
            <br />
            &nbsp; dream.<span className="orange">big</span>()
            <br />
            &nbsp; create.<span className="green">something_amazing</span>
            ()
            <br />
            <br />
            <span className="comment"># the possibilities are endless</span>
          </div>
          <div className="art-badge">
            <Sparkles size={18} /> Aha! I made that.
          </div>
        </div>
        <span className="art-plus">+</span>
        <div className="curiosity-pill">
          <Code2 size={16} /> Little creators. Big thinkers.
        </div>
      </div>
      <div className="benefits">
        <div>
          <span>
            <Video size={19} />
          </span>
          <p>
            <strong>One child. One mentor.</strong>Personal attention from the
            very first class.
          </p>
        </div>
        <div>
          <span>
            <Clock3 size={19} />
          </span>
          <p>
            <strong>30 minutes of discovery</strong>A hands-on introduction, at
            your pace.
          </p>
        </div>
        <div>
          <span>
            <Heart size={19} />
          </span>
          <p>
            <strong>Free to try. Easy to love.</strong>No payment details. No
            commitment.
          </p>
        </div>
      </div>
      <div className="mentor-note">
        <div className="avatars">
          <span>AR</span>
          <span>DM</span>
          <span>SK</span>
        </div>
        <p>
          <strong>10 mentors. Endless encouragement.</strong>
          <br />A friendly guide for your child’s first step.
        </p>
      </div>
    </aside>
  );
}
